import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Badge, Tooltip, type BadgeTone } from '~kit'
import type { ProcessPhase } from '~indexer/selectors'
import {
  CENSUS_ORIGIN_INFO,
  KEY_MODE_INFO,
  PROCESS_STATUS_INFO,
  type CensusOriginName,
  type KeyModeName,
  type ProcessStatusName,
} from '~protocol/types'

/** A phase's badge; `status` borrows the registry status's explanation. */
const PHASE: Record<
  ProcessPhase,
  { label: MessageDescriptor; tone: BadgeTone; dot?: boolean } & (
    { description: MessageDescriptor } | { status: ProcessStatusName }
  )
> = {
  loading: { label: msg`Loading`, tone: 'neutral', description: msg`Still reading this election from the chain.` },
  upcoming: { label: msg`Upcoming`, tone: 'info', description: msg`Voting has not started yet.` },
  open: { label: msg`Open`, tone: 'ok', dot: true, status: 'ready' },
  paused: { label: msg`Paused`, tone: 'warn', status: 'paused' },
  closed: {
    label: msg`Voting closed`,
    tone: 'warn',
    description: msg`The voting time is over. The registry still reads Ready until someone ends the election or publishes the results.`,
  },
  ended: { label: msg`Ended`, tone: 'neutral', status: 'ended' },
  canceled: { label: msg`Canceled`, tone: 'danger', status: 'canceled' },
  results: { label: msg`Results`, tone: 'done', status: 'results' },
}

/** A phase's badge tone; the overview's phase chart uses the same, so a slice and a tag look alike. */
export const PHASE_TONE: Readonly<Record<ProcessPhase, BadgeTone>> = Object.fromEntries(
  Object.entries(PHASE).map(([phase, p]) => [phase, p.tone])
) as Record<ProcessPhase, BadgeTone>

/** A process's phase (on-chain status plus the clock), with its meaning on hover. */
export function ProcessPhaseBadge({ phase, size }: { phase: ProcessPhase; size?: 'sm' | 'md' }) {
  const { i18n } = useLingui()
  const p = PHASE[phase]
  const description = 'status' in p ? PROCESS_STATUS_INFO[p.status].description : i18n._(p.description)
  return (
    <Tooltip content={description}>
      <span className='inline-flex max-w-full'>
        <Badge tone={p.tone} dot={p.dot} size={size}>
          {i18n._(p.label)}
        </Badge>
      </span>
    </Tooltip>
  )
}

/** Who holds the key: violet for every mode, so it never competes with the phase beside it. */
export function KeyModeBadge({ mode, size }: { mode: KeyModeName; size?: 'sm' | 'md' }) {
  const info = KEY_MODE_INFO[mode]
  return (
    <Tooltip content={info.description}>
      <span className='inline-flex max-w-full'>
        <Badge tone='violet' size={size}>
          {info.label}
        </Badge>
      </span>
    </Tooltip>
  )
}

/** Where the voters come from: slate, a calm category tint. */
export function CensusOriginBadge({ origin, size }: { origin: CensusOriginName; size?: 'sm' | 'md' }) {
  const info = CENSUS_ORIGIN_INFO[origin]
  return (
    <Tooltip content={info.description}>
      <span className='inline-flex max-w-full'>
        <Badge tone='slate' size={size}>
          {info.label}
        </Badge>
      </span>
    </Tooltip>
  )
}
