import { afterEach, describe, expect, it } from 'vitest'
import { demoFixture } from '~fixtures/demo'
import { activateLocale } from '~i18n/i18n'
import { formatNumber } from '~lib/format'
import { processRow, transitionRows } from '~indexer/selectors'
import { B8, isOnCurve } from '~protocol/babyjubjub'
import { BN254_FR } from '~protocol/limits'
import { BJJ_K, BJJ_K_INV, reducedToCircom } from '~protocol/babyjubjub'
import { dkgApplicationUrl, dkgEpochUrl } from './dkg-links'
import { toJson } from './json'
import { browsableUri, readServedDocument } from '~protocol/metadata'
import { localized, metadataChoices, metadataDescription, metadataPreset, metadataTitle } from './metadata'
import { tallyRows } from './tally'
import { processLifecycle } from './timeline'

// Tests read English; one that switches language switches back.
afterEach(() => activateLocale('en'))

describe('metadata', () => {
  const doc = {
    title: { default: 'Board election' },
    questions: [
      {
        title: 'Who?',
        choices: [
          { title: { default: 'B' }, value: 1 },
          { title: { default: 'A' }, value: 0 },
        ],
      },
    ],
  }

  it('reads titles and choices', () => {
    expect(metadataTitle(doc)).toBe('Board election')
    expect(localized({ ca: 'Hola' })).toBe('Hola')
    expect(localized(3)).toBeNull()
    expect(metadataChoices(doc, 2)).toEqual(['A', 'B'])
    expect(metadataChoices(doc, 3)).toBeNull()
    expect(metadataChoices('nope', 2)).toBeNull()
  })

  it('reads the ballot kind the organizer declared', () => {
    expect(metadataPreset({ meta: { electionPreset: { type: 'quadratic', budget: 100 } } })).toBe('quadratic')
    expect(metadataPreset(doc)).toBeNull()
    expect(metadataPreset({ meta: { electionPreset: 'quadratic' } })).toBeNull()
    expect(metadataPreset({ meta: { electionPreset: { type: 3 } } })).toBeNull()
  })

  it('prefers the language asked for, then default, then the first with text', () => {
    const text = { default: 'Vote', es: 'Voto', ca: 'Vot' }
    expect(localized(text, 'es')).toBe('Voto')
    expect(localized(text, 'ca')).toBe('Vot')
    expect(localized(text, 'en')).toBe('Vote')
    expect(localized({ default: 'Vote', en: 'Ballot' }, 'en')).toBe('Ballot')
    expect(localized({ es: '  ', default: ' Vote ' }, 'es')).toBe('Vote')
    expect(localized({ fr: '', ca: 'Vot', es: 'Voto' }, 'en')).toBe('Vot')
    expect(localized({ es: 3, default: null }, 'es')).toBeNull()
    expect(localized('  plain  ', 'es')).toBe('plain')
  })

  it('follows the active language', async () => {
    const multi = {
      title: { default: 'Board election', es: 'Elección de la junta', ca: 'Elecció de la junta' },
      description: { default: 'Pick one.', ca: 'Trieu-ne una.' },
      questions: [{ choices: [{ title: { default: 'Yes', ca: 'Sí' } }, { title: 'No' }] }],
    }
    expect(metadataTitle(multi)).toBe('Board election')
    await activateLocale('ca')
    expect(metadataTitle(multi)).toBe('Elecció de la junta')
    expect(metadataDescription(multi)).toBe('Trieu-ne una.')
    expect(metadataChoices(multi, 2)).toEqual(['Sí', 'No'])
    await activateLocale('es')
    expect(metadataTitle(multi)).toBe('Elección de la junta')
    expect(metadataDescription(multi)).toBe('Pick one.')
  })

  it('reads the demo documents in each language', async () => {
    const f = demoFixture()
    const process = f.store.processes[f.featured.openProcess]!
    const doc = readServedDocument(f.metadata.get(process.state!.metadataURI)!).doc
    const en = metadataTitle(doc)
    expect(en).toBeTruthy()
    await activateLocale('ca')
    const ca = metadataTitle(doc)
    await activateLocale('es')
    const es = metadataTitle(doc)
    expect(new Set([en, ca, es]).size).toBe(3)
  })

  it('links only what a browser opens', () => {
    expect(browsableUri('ipfs://bafy')).toBe('https://ipfs.io/ipfs/bafy')
    expect(browsableUri('https://x.org/a.json')).toBe('https://x.org/a.json')
    expect(browsableUri('javascript:alert(1)')).toBeNull()
  })
})

describe('small helpers', () => {
  it('toJson writes bigints as decimal strings', () => {
    expect(toJson({ a: 10n ** 30n, b: [1n] })).toBe(
      '{\n  "a": "1000000000000000000000000000000",\n  "b": [\n    "1"\n  ]\n}'
    )
  })

  it('tallyRows shares and bar lengths', () => {
    const rows = tallyRows([1n, 3n, 0n], ['x', 'y', 'z'])
    expect(rows.map((r) => r.share)).toEqual([0.25, 0.75, 0])
    expect(rows.map((r) => r.ofMax)).toEqual([0.333333, 1, 0])
    expect(tallyRows([0n, 0n])[1]).toMatchObject({ label: 'Field 2', share: 0, ofMax: 0 })
  })

  it('dkg links', () => {
    expect(dkgEpochUrl('https://dkg.example.org/', '0xAB')).toBe('https://dkg.example.org/epochs/0xab')
    expect(dkgApplicationUrl('https://d', '0xE', '0xA')).toBe('https://d/applications/0xe/0xa')
    expect(dkgApplicationUrl(undefined, '0xe', '0xa')).toBeNull()
  })
})

describe('BabyJubJub forms', () => {
  it('K matches BjjFormLib', () => {
    expect((BJJ_K * BJJ_K) % BN254_FR).toBe(BN254_FR - 168700n)
    expect((BJJ_K * BJJ_K_INV) % BN254_FR).toBe(1n)
  })

  it('maps a reduced point onto the circomlib curve', () => {
    const te = B8
    const reduced = { x: (te.x * BJJ_K) % BN254_FR, y: te.y }
    expect(reducedToCircom(reduced)).toEqual(te)
    expect(isOnCurve(reducedToCircom(reduced))).toBe(true)
  })
})

describe('processLifecycle', () => {
  const f = demoFixture()
  const now = f.store.chain.headTimestamp
  const lifecycle = (pid: string) => {
    const process = f.store.processes[pid]!
    return processLifecycle(
      { process, row: processRow(f.store, process), transitions: transitionRows(f.store, pid) },
      now
    )
  }
  const states = (pid: string) => lifecycle(pid).map((s) => s.state)

  it('an open process is collecting transitions', () => {
    expect(states(f.featured.openProcess)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming'])
    expect(lifecycle(f.featured.openProcess)[4]).toMatchObject({ detail: '3 min for batches still on their way' })
  })

  it('a process with results is done throughout', () => {
    const steps = lifecycle(f.featured.resultsProcess)
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'done'])
    expect(steps[5]!.tx).toBe(f.store.processes[f.featured.resultsProcess]!.results!.tx)
  })

  it('a tally waiting for the reveal shows the decryption request', () => {
    const steps = lifecycle(f.featured.awaitingReveal)
    expect(steps[5]).toMatchObject({ state: 'current', detail: 'Sent to the committee to decrypt' })
  })

  it('a process in its grace window is recording its last batches', () => {
    const pid = f.featured.closingProcess
    const steps = lifecycle(pid)
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'current', 'upcoming'])
    expect(steps[4]).toMatchObject({
      detail: 'Recording the last batches',
      time: processRow(f.store, f.store.processes[pid]!).graceEnd,
    })
    expect(steps[5]).toMatchObject({ detail: 'After the grace window' })
  })

  it('a closed grace window counts what it let in, and the results are next', () => {
    const steps = lifecycle(f.featured.graceSettled)
    expect(steps[4]).toMatchObject({ state: 'done', detail: '2 batches recorded in it' })
    expect(steps[5]).toMatchObject({ state: 'current', detail: 'Pending' })
  })

  it('shows an end the organizer moved earlier', () => {
    const pid = f.featured.shortenedEnd
    const change = f.store.processes[pid]!.durationChanges[0]!
    const creation = f.store.txDetails[f.store.processes[pid]!.createdTx!]!
    const process = f.store.processes[pid]!
    const steps = processLifecycle(
      { process, row: processRow(f.store, process), transitions: transitionRows(f.store, pid) },
      now,
      creation.initialDuration
    )
    expect(steps[3]).toMatchObject({ state: 'upcoming', detail: 'Moved earlier by the organizer', tx: change.tx })
  })

  it('counts batches and ballots in one phrase', () => {
    const steps = lifecycle(f.featured.openProcess)
    const transitions = transitionRows(f.store, f.featured.openProcess)
    const ballots = transitions.reduce((n, t) => n + t.votes, 0)
    expect(steps[2]!.detail).toBe(`${transitions.length} batches, ${formatNumber(ballots)} votes`)
    expect(steps[0]!.detail).toMatch(/^Block [\d,]+$/)
  })

  it('tells an end by the organizer from the end time', () => {
    const find = (test: (p: (typeof f.store.processes)[string]) => boolean) =>
      f.store.processOrder.find((k) => test(f.store.processes[k]!))!
    // The committee's decryption request moved this one to Ended once its end time had passed.
    const requested = find((p) => p.state?.status === 'results' && p.decryptionRequest != null)
    expect(lifecycle(requested)[3]).toMatchObject({ state: 'done', detail: 'End time reached', tx: null })
    const ended = find((p) => p.state?.status === 'ended' && p.decryptionRequest == null)
    const end = f.store.processes[ended]!.statusChanges.find((c) => c.to === 'ended')!
    expect(lifecycle(ended)[3]).toMatchObject({ state: 'done', detail: 'Ended by the organizer', tx: end.tx })
  })

  it('an upcoming process has no batch yet', () => {
    const upcoming = f.store.processOrder.find((k) => processRow(f.store, f.store.processes[k]!).phase === 'upcoming')!
    expect(lifecycle(upcoming)[2]).toMatchObject({ state: 'upcoming', detail: 'No batch recorded yet' })
  })

  it('a paused process collects batches again once its end passes, until the window closes', () => {
    const pid = f.store.processOrder.find((k) => f.store.processes[k]!.state?.status === 'paused')!
    const process = f.store.processes[pid]!
    const row = processRow(f.store, process)
    const transitions = transitionRows(f.store, pid)
    const paused = processLifecycle({ process, row, transitions }, now)
    expect(paused[2]!.state).toBe('current')
    expect(paused[3]!.detail).toBe('Paused by the organizer')
    // Past the end a pause no longer holds: the phase is Closing, then Ended.
    const closing = processLifecycle({ process, row: { ...row, phase: 'closing' }, transitions }, now)
    expect(closing.map((s) => s.state).slice(2)).toEqual(['done', 'done', 'current', 'upcoming'])
    expect(processLifecycle({ process, row: { ...row, phase: 'ended' }, transitions: [] }, now)[2]).toMatchObject({
      state: 'skipped',
      detail: 'No batch recorded',
    })
  })

  it('a canceled process skips the end, the grace window and the results', () => {
    const canceled = f.store.processOrder.find((k) => f.store.processes[k]!.state?.status === 'canceled')!
    expect(states(canceled).slice(3)).toEqual(['skipped', 'skipped', 'skipped'])
  })
})
