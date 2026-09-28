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
  loading: { label: msg`Loading`, tone: 'neutral', description: msg`The process state has not been read yet.` },
  upcoming: { label: msg`Upcoming`, tone: 'neutral', description: msg`Ready, but the voting window has not opened.` },
  open: { label: msg`Open`, tone: 'ok', dot: true, status: 'ready' },
  paused: { label: msg`Paused`, tone: 'warn', status: 'paused' },
  closed: {
    label: msg`Voting closed`,
    tone: 'warn',
    description: msg`The end time has passed. The registry still says Ready until someone ends it or posts results.`,
  },
  ended: { label: msg`Ended`, tone: 'neutral', status: 'ended' },
  canceled: { label: msg`Canceled`, tone: 'danger', status: 'canceled' },
  results: { label: msg`Results`, tone: 'accent', status: 'results' },
}

/** A process's phase (on-chain status plus the clock), with its meaning on hover. */
export function ProcessPhaseBadge({ phase, size }: { phase: ProcessPhase; size?: 'sm' | 'md' }) {
  const { i18n } = useLingui()
  const p = PHASE[phase]
  const description = 'status' in p ? PROCESS_STATUS_INFO[p.status].description : i18n._(p.description)
  return (
    <Tooltip content={description}>
      <span className='inline-flex'>
        <Badge tone={p.tone} dot={p.dot} size={size}>
          {i18n._(p.label)}
        </Badge>
      </span>
    </Tooltip>
  )
}

export function KeyModeBadge({ mode, size }: { mode: KeyModeName; size?: 'sm' | 'md' }) {
  const info = KEY_MODE_INFO[mode]
  return (
    <Tooltip content={info.description}>
      <span className='inline-flex'>
        <Badge tone={mode === 'sequencer' ? 'neutral' : 'accent'} size={size}>
          {info.label}
        </Badge>
      </span>
    </Tooltip>
  )
}

export function CensusOriginBadge({ origin, size }: { origin: CensusOriginName; size?: 'sm' | 'md' }) {
  const info = CENSUS_ORIGIN_INFO[origin]
  return (
    <Tooltip content={info.description}>
      <span className='inline-flex'>
        <Badge tone='neutral' size={size}>
          {info.label}
        </Badge>
      </span>
    </Tooltip>
  )
}
