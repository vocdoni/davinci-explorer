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
      detail: pub
        ? failMask
          ? t`ok = ${ok}, fail mask = ${failMask} (${failBits})`
          : t`ok = ${ok}, fail mask = ${failMask}`
        : t`Waiting for the transaction’s calldata`,
    },
    {
      id: 'final-root',
      label: t`Proven against the final state root`,
      state:
        pub && lastRoot
          ? pub.stateRoot === lastRoot && pub.stateRoot === s.latestStateRoot
            ? 'pass'
            : 'fail'
          : 'unknown',
      detail: pub ? (
        <span className='inline-flex flex-wrap items-center gap-1'>
          <Trans>
            public values register 2..9 <Hash value={pub.stateRoot} chars={6} /> against the last transition’s root
          </Trans>
        </span>
      ) : (
        t`public values register 2..9 against the last transition’s root`
      ),
    },
    {
      id: 'tally-proven',
      label: t`The stored tally is the proven one`,
      state: pub
        ? results.values.length === nf && results.values.every((v, i) => pub.results[i] === v)
          ? 'pass'
          : 'fail'
        : 'unknown',
      detail: t`registers 10..${lastRegister}, one 64-bit value per field, against the ProcessResultsSet event`,
    },
    {
      id: 'plonk',
      label: t`The PLONK verified on-chain`,
      state: 'pass',
      detail: t`The registry emits ProcessResultsSet only after the verifier accepted the proof under the results program vk.`,
    },
  ]
  return { checks, publics: pub, decodeError: decoded.error }
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

  const checks: ResultsCheck[] = request
    ? [
        {
          id: 'accumulator',
          label: t`The accumulator is the one in the final state root`,
          state: 'pass',
          detail: t`ResultsDecryptionRequested is emitted only after the registry verified the accumulator’s inclusion as leaf 0x04.`,
        },
        ...(locked
          ? [
              {
                id: 'revealed' as const,
                label: t`The organizer revealed its secret`,
                state: (app ? (app.revealed ? 'pass' : 'unknown') : 'unknown') as CheckState,
                detail: app?.revealed
                  ? t`The DKG checked sk·G = PK_org when it accepted the reveal.`
                  : t`Until the reveal the DKG refuses every partial decryption and combine.`,
              },
            ]
          : []),
        {
          id: 'combined',
          label: t`Every submitted ciphertext is combined`,
          state: (app ? (completed === submitted ? 'pass' : 'unknown') : 'unknown') as CheckState,
          detail: app
            ? t`${combined} of ${total} combined on the DKG`
            : dkg.isLoading
              ? t`Reading the DKG contracts…`
              : t`The DKG state could not be read`,
        },
        ...(results && app && app.ciphertexts.length > 0
          ? [
              {
                id: 'tally-plaintexts' as const,
                label: t`The stored tally is the committee’s plaintexts`,
                state: (app.ciphertexts.every((c) => c.completed && results.values[c.field] === c.plaintext)
                  ? 'pass'
                  : 'fail') as CheckState,
                detail: t`Each combined plaintext against its field in ProcessResultsSet.`,
              },
            ]
          : []),
      ]
    : []
  return { checks, app, loading: dkg.isLoading, completed, submitted }
}
