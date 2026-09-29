import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { ProcessIdLink, Timestamp, TxLink } from '~components'
import { useActivityFeed, useIndexer } from '~data/hooks'
import type { FeedKind } from '~indexer/selectors'
import { Badge, EmptyState, Panel, SkeletonText, type BadgeTone } from '~kit'

// The same tinted tones as every other tag: results in the results green, the
// census and key tints of their badges, creation as information.
const KIND: Record<FeedKind, { label: MessageDescriptor; tone: BadgeTone }> = {
  created: { label: msg({ message: 'created', context: 'activity kind' }), tone: 'info' },
  transition: { label: msg({ message: 'transition', context: 'activity kind' }), tone: 'ok' },
  results: { label: msg({ message: 'results', context: 'activity kind' }), tone: 'done' },
  status: { label: msg({ message: 'status', context: 'activity kind' }), tone: 'neutral' },
  decryption: { label: msg({ message: 'decryption', context: 'activity kind' }), tone: 'violet' },
  census: { label: msg({ message: 'census', context: 'activity kind' }), tone: 'slate' },
  metadata: { label: msg({ message: 'metadata', context: 'activity kind' }), tone: 'neutral' },
  duration: { label: msg({ message: 'duration', context: 'activity kind' }), tone: 'neutral' },
  'max-voters': { label: msg({ message: 'limit', context: 'activity kind' }), tone: 'neutral' },
}

/** The newest registry events, network-wide. */
export function ActivityPanel({ limit = 12 }: { limit?: number }) {
  const { i18n, t } = useLingui()
  const feed = useActivityFeed(limit)
  const { loading } = useIndexer()

  return (
    <Panel
      title={t`Recent activity`}
      label={t`Registry events`}
      description={t`What happened on the registry, newest first: new processes, batches of votes recorded, status changes and results.`}
      bodyClassName='p-0'
    >
      {loading ? (
        <SkeletonText lines={8} className='p-5' />
      ) : feed.length === 0 ? (
        <EmptyState
          compact
          title={t`No activity yet`}
          description={t`New processes, batches of votes, status changes and results will be listed here as they happen on the registry.`}
        />
      ) : (
        <ul className='divide-y divide-charcoal/60'>
          {feed.map((e) => (
            <li key={e.key} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[13px]'>
              <Badge tone={KIND[e.kind].tone} size='sm' className='min-w-[74px] justify-center'>
                {i18n._(KIND[e.kind].label)}
              </Badge>
              <Link to={e.href} className='min-w-0 flex-1 truncate text-silver hover:text-emerald'>
                {e.label}
              </Link>
              <span className='flex items-center gap-3 max-sm:w-full max-sm:justify-between max-sm:pl-[86px]'>
                <ProcessIdLink id={e.processId} chars={6} className='text-ash' />
                {e.tx ? <TxLink hash={e.tx} chars={4} className='max-md:hidden' /> : null}
                <Timestamp value={e.timestamp} className='text-right text-xs text-ash sm:w-[88px]' />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
