import { Trans, useLingui } from '@lingui/react/macro'
import { Term } from '~components/Term'
import type { ChainMeta } from '~indexer/types'
import { Panel, Skeleton } from '~kit'
import { formatNumber, formatSeconds } from '~lib/format'
import { ParamList, type Param } from './ParametersPanel'
import { Code, TechnicalToggle } from './parts'

const GRACE_END = 'graceEnd = min(end + graceMaxTotal, max(end, lastVoteAt) + grace)'

/** The registry's five settings for closing an election: the grace window and the notice to move an end earlier. */
export function GracePanel({
  chain,
  technical = false,
  onTechnical,
}: {
  chain: ChainMeta
  /** Show each value's mechanism. */
  technical?: boolean
  onTechnical?: (on: boolean) => void
}) {
  const { t } = useLingui()
  const r = chain.registry
  const seconds = (v: number | undefined) =>
    v == null ? (
      <Skeleton className='h-4 w-24' />
    ) : (
      <span className='font-mono tnum text-ghost'>
        {formatSeconds(v)}
        {v >= 60 ? <span className='text-ash'> · {formatNumber(v)} s</span> : null}
      </span>
    )

  const params: Param[] = [
    {
      id: 'defaultGrace',
      title: t`Grace window of a new election`,
      source: 'registry.defaultGrace()',
      value: seconds(r?.defaultGrace),
      what: t`How long a new election keeps recording batches of votes after its end, counted from the end or from the last batch recorded after it.`,
      why: t`Sequencers record votes in batches, so votes cast just before the end can still be on their way when it passes. The window lets them count, and the results wait until it closes.`,
      detail: (
        <Trans>
          Every <Code>newProcess</Code> starts with <Code>grace = defaultGrace</Code>. Transitions settle while the
          block time is below <Code>getProcessGraceEnd(processId)</Code>, below; <Code>setProcessResults</Code>,{' '}
          <Code>requestResultsDecryption</Code> and <Code>finalizeResultsFromDKG</Code> revert with{' '}
          <Code>GraceOpen</Code> until then.
        </Trans>
      ),
      formula: GRACE_END,
    },
    {
      id: 'graceFloor',
      title: t`Shortest grace window`,
      source: 'registry.graceFloor()',
      value: seconds(r?.graceFloor),
      what: t`The shortest grace window an organizer can set for an election.`,
      why: t`It leaves the batches still on their way enough time to be recorded after the end.`,
      detail: (
        <Trans>
          <Code>setProcessGrace</Code> reverts with <Code>InvalidGrace</Code> below it. The registry could only be
          deployed with its settings in this order:
        </Trans>
      ),
      formula: '0 < graceFloor ≤ defaultGrace ≤ graceCeil ≤ graceMaxTotal',
    },
    {
      id: 'graceCeil',
      title: t`Longest grace window`,
      source: 'registry.graceCeil()',
      value: seconds(r?.graceCeil),
      what: t`The longest grace window an organizer can set for an election.`,
      why: t`It keeps the wait between the end and the results short.`,
      detail: (
        <Trans>
          <Code>setProcessGrace(processId, grace)</Code> accepts a value between the two bounds, only while the process
          is Ready or Paused and before its end, and emits <Code>ProcessGraceChanged</Code>.
        </Trans>
      ),
      formula: 'graceFloor ≤ grace ≤ graceCeil',
    },
    {
      id: 'graceMaxTotal',
      title: t`Latest close after the end`,
      source: 'registry.graceMaxTotal()',
      value: seconds(r?.graceMaxTotal),
      what: t`However many batches keep arriving, the grace window closes at most this long after the end.`,
      why: t`Each batch recorded after the end moves the window later. The cap keeps anyone from holding the results back, and bounds how long a vote cast after the end could slip in: the registry cannot tell when a vote was cast.`,
      detail: (
        <Trans>
          <Code>lastVoteAt</Code> is the block time of the last settled transition. Each one after the end extends the
          window by <Code>grace</Code> from its own time, up to <Code>end + graceMaxTotal</Code>. A transition must add
          a vote (<Code>EmptyTransition</Code> otherwise), so a batch of silent refreshes alone cannot extend it.
        </Trans>
      ),
      formula: GRACE_END,
    },
    {
      id: 'noticeMin',
      title: t`Notice to move an end earlier`,
      source: 'registry.noticeMin()',
      value: seconds(r?.noticeMin),
      what: t`An organizer can move the end of an election earlier, but only to a time at least this far away.`,
      why: t`Everyone, the sequencers included, sees the new end before it arrives, so no vote accepted under the old end is left out. It is what lets a live meeting announce that voting closes in one minute.`,
      detail: (
        <Trans>
          <Code>setProcessDuration</Code> accepts a shorter duration only when the new end is at least{' '}
          <Code>noticeMin</Code> seconds after the call, and emits <Code>ProcessDurationChanged</Code>.{' '}
          <Code>setProcessStatus(ENDED)</Code> still ends voting at once.
        </Trans>
      ),
      formula: 'startTime + duration ≥ block.timestamp + noticeMin',
    },
  ]

  return (
    <Panel
      title={t`Closing an election`}
      label={t`Grace window and notice`}
      description={
        <Trans>
          How the registry closes an election. After the end it keeps recording batches of votes cast before it for a
          short <Term id='grace-window'>grace window</Term>, and accepts the results only once that window closes. These
          settings were fixed when the registry was deployed.
        </Trans>
      }
      actions={onTechnical ? <TechnicalToggle checked={technical} onChange={onTechnical} /> : undefined}
    >
      <ParamList params={params} technical={technical} />
    </Panel>
  )
}
