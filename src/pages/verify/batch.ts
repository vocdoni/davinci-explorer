// A settled batch's checks as the Verify flows count them. Pure, unit-tested.

import type { CheckState, TransitionDetail } from '~indexer/selectors'

export interface BatchCheck {
  id: string
  label: string
  state: CheckState
}

/** The settlement transaction went through: the proof and the blob openings verified on-chain. */
export function onchainState(detail: TransitionDetail): CheckState {
  return detail.tx ? (detail.tx.status === 'success' ? 'pass' : 'fail') : 'unknown'
}

/**
 * The recomputed settlement checks, then the on-chain verification. With an
 * on-chain census the explorer cannot redo the census check (the registry
 * asked the census contract), so a settled batch counts as its evidence;
 * `onchainCensusLabel` names the check that way.
 */
export function batchChecks(
  detail: TransitionDetail,
  labels: { onchain: string; onchainCensus: string }
): BatchCheck[] {
  const settled = onchainState(detail)
  const onchainCensus = detail.process.state?.census.origin === 'onchain-dynamic'
  return [
    ...detail.checks.map((c) =>
      c.id === 'census-root' && onchainCensus && c.state === 'unknown'
        ? { id: c.id, label: labels.onchainCensus, state: settled }
        : { id: c.id, label: c.label, state: c.state }
    ),
    { id: 'onchain', label: labels.onchain, state: settled },
  ]
}
