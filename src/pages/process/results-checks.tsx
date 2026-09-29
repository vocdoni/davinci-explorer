// The checks behind a published tally, recomputed from public data: the
// results tab shows them and the Verify election and vote flows reuse them.
// Sequencer key: the zkVM results proof in the results transaction. DKG key:
// the decryption request and the committee's combines.

import { useEffect, useMemo, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useDataSource } from '~data/context'
import { useStore, type ProcessView } from '~data/hooks'
import { useDkgApplication } from '~data/queries'
import type { DkgApplicationView } from '~data/services'
import type { CheckState } from '~indexer/selectors'
import { txKey } from '~indexer/types'
import { Formula } from '~components/Formula'
import { Hash } from '~kit'
import { formatNumber } from '~lib/format'
import { decodeResultsPublicValues, resultsFailBits, type ResultsPublics } from '~protocol/publics'

export type ResultsCheckId =
  'program-ok' | 'final-root' | 'tally-proven' | 'plonk' | 'accumulator' | 'revealed' | 'combined' | 'tally-plaintexts'

export interface ResultsCheck {
  id: ResultsCheckId
  label: string
  state: CheckState
  detail: ReactNode
}

export interface SequencerResults {
  /** Empty until the process has results. */
  checks: ResultsCheck[]
  publics: ResultsPublics | null
  decodeError: string | null
}

/**
 * The results proof of a sequencer-key process against the final state root;
 * asks for the transaction first. Nothing for another key mode.
 */
export function useSequencerResultsChecks(view: ProcessView | null): SequencerResults {
  const { t } = useLingui()
  const store = useStore()
  const source = useDataSource()
  const s = view?.process.state?.keyMode === 'sequencer' ? view.process.state : null
  const results = s ? view!.process.results : null
  const tx = results?.tx ? store.txDetails[txKey(results.tx)] : undefined
  useEffect(() => {
    if (results?.tx && !tx) source.ensureTxDetails([results.tx])
  }, [source, results?.tx, tx])

  const decoded = useMemo((): { publics: ResultsPublics | null; error: string | null } => {
    if (!tx?.publicValues) return { publics: null, error: tx?.decodeError ?? null }
    try {
      return { publics: decodeResultsPublicValues(tx.publicValues), error: null }
    } catch (err) {
      return { publics: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [tx])

  if (!results || !s || !view) return { checks: [], publics: decoded.publics, decodeError: decoded.error }

  const pub = decoded.publics
  const lastRoot = view.transitions[view.transitions.length - 1]?.rootAfter ?? view.process.genesisRoot
  const nf = s.ballotMode.numFields
  const ok = pub?.ok ? 1 : 0
  const failMask = pub?.failMask ?? 0
  const failBits = pub ? resultsFailBits(pub.failMask).join(', ') : ''
  const lastRegister = 9 + 2 * nf
  const checks: ResultsCheck[] = [
    {
      id: 'program-ok',
      label: t`The results program passed every check`,
      state: pub ? (pub.ok && pub.failMask === 0 ? 'pass' : 'fail') : 'unknown',
      detail: pub ? (
        failMask ? (
          <Trans>
            <Formula expr={`ok = ${ok}, fail_mask = ${failMask}`} />, failed: {failBits}
          </Trans>
        ) : (
          <Formula expr={`ok = ${ok}, fail_mask = ${failMask}`} />
        )
      ) : (
        t`Waiting for the transaction’s data`
      ),
    },
    {
      id: 'final-root',
      label: t`Proven from the election’s final state`,
      state:
        pub && lastRoot
          ? pub.stateRoot === lastRoot && pub.stateRoot === s.latestStateRoot
            ? 'pass'
            : 'fail'
          : 'unknown',
      detail: pub ? (
        <span className='inline-flex flex-wrap items-center gap-1'>
          {view.transitions.length > 0 ? (
            <Trans>
              The proof starts from the fingerprint of the state after the last batch (the state root, registers 2 to
              9): <Hash value={pub.stateRoot} chars={6} />
            </Trans>
          ) : (
            <Trans>
              No batch was recorded, so the proof starts from the fingerprint of the starting state (the state root,
              registers 2 to 9): <Hash value={pub.stateRoot} chars={6} />
            </Trans>
          )}
        </span>
      ) : (
        t`The fingerprint of the state the proof starts from (registers 2 to 9), against the one after the last batch.`
      ),
    },
    {
      id: 'tally-proven',
      label: t`The stored results are the proven ones`,
      state: pub
        ? results.values.length === nf && results.values.every((v, i) => pub.results[i] === v)
          ? 'pass'
          : 'fail'
        : 'unknown',
      detail: t`The totals in the proof, against the ones the registry recorded (registers 10 to ${lastRegister}, one 64-bit value per field, and the ProcessResultsSet event).`,
    },
    {
      id: 'plonk',
      label: t`The proof was checked on the chain`,
      state: 'pass',
      detail: t`The registry records the results, and emits ProcessResultsSet, only after the verifier accepted the PLONK proof under the results program (resultsProgramVK).`,
    },
  ]
  return { checks, publics: pub, decodeError: decoded.error }
}

/**
 * The stored tally is the committee's: every decrypted value in its field,
 * and 0 in each field that was empty and never sent.
 */
export function tallyMatches(values: bigint[], ciphertexts: DkgApplicationView['ciphertexts']): boolean {
  const sent = new Map(ciphertexts.map((c) => [c.field, c]))
  return values.every((v, field) => {
    const c = sent.get(field)
    return c ? c.completed && c.plaintext === v : v === 0n
  })
}

export interface DkgResults {
  /** Empty until the decryption was requested. */
  checks: ResultsCheck[]
  app: DkgApplicationView | null | undefined
  loading: boolean
  completed: number
  submitted: number
}

/**
 * The committee's decryption of a DKG-key process: the request, the reveal,
 * the combines and the stored tally. Nothing for a sequencer key.
 */
export function useDkgResultsChecks(view: ProcessView | null): DkgResults {
  const { t } = useLingui()
  const s = view?.process.state
  const dkg = useDkgApplication(view?.process.id)
  const request = s && s.keyMode !== 'sequencer' ? view!.process.decryptionRequest : null
  const results = view?.process.results
  const app = dkg.data
  const locked = s?.keyMode === 'dkg-locked'
  const completed = app?.ciphertexts.filter((c) => c.completed).length ?? 0
  const submitted = s?.dkg?.count ?? 0
  const combined = formatNumber(completed)
  const total = formatNumber(submitted)

  // Nothing goes to the committee when every field is empty (no ballot was
  // counted): the registry records the zeros in the request's transaction.
  const empty = request?.count === 0
  const checks: ResultsCheck[] = request
    ? [
        {
          id: 'accumulator',
          label: t`The encrypted total is the one in the final state`,
          state: 'pass',
          detail: t`The registry emits ResultsDecryptionRequested only after checking that the encrypted total (the accumulator) is leaf 0x04 of the final state root.`,
        },
        ...(locked && !empty
          ? [
              {
                id: 'revealed' as const,
                label: t`The organizer secret was revealed`,
                state: (app ? (app.revealed ? 'pass' : 'unknown') : 'unknown') as CheckState,
                detail: app?.revealed ? (
                  <Trans>
                    The key committee’s contracts checked the secret against the organizer key when they accepted the
                    reveal: <Formula expr='sk · G = PK_org' />.
                  </Trans>
                ) : (
                  t`Until the reveal the committee cannot decrypt: its contracts refuse every partial decryption and combine.`
                ),
              },
            ]
          : []),
        empty
          ? {
              id: 'combined',
              label: t`Nothing had to be decrypted`,
              state: 'pass',
              detail: t`No ballot was counted, so every field of the encrypted total was empty and nothing went to the key committee.`,
            }
          : {
              id: 'combined',
              label: t`Every value sent to the key committee is decrypted`,
              state: (app ? (completed === submitted ? 'pass' : 'unknown') : 'unknown') as CheckState,
              detail: app
                ? t`${combined} of ${total} decrypted by the key committee, each from its members’ partial decryptions`
                : dkg.isLoading
                  ? t`Reading the key committee’s contracts…`
                  : t`The key committee’s contracts could not be read`,
            },
        ...(results && empty
          ? [
              {
                id: 'tally-plaintexts' as const,
                label: t`Every stored total is 0`,
                state: (results.values.every((v) => v === 0n) ? 'pass' : 'fail') as CheckState,
                detail: t`With nothing to decrypt, the registry records 0 for every field, in the same transaction as the request.`,
              },
            ]
          : results && app && app.ciphertexts.length > 0
            ? [
                {
                  id: 'tally-plaintexts' as const,
                  label: t`The stored totals are the key committee’s decrypted values`,
                  state: (tallyMatches(results.values, app.ciphertexts) ? 'pass' : 'fail') as CheckState,
                  detail: t`Each decrypted value against its field in the ProcessResultsSet event, and 0 for a field that was empty.`,
                },
              ]
            : []),
      ]
    : []
  return { checks, app, loading: dkg.isLoading, completed, submitted }
}
