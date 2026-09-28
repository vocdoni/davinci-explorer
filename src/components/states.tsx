import { useLingui } from '@lingui/react/macro'
import { EmptyState, SkeletonText } from '~kit'
import { useIndexer } from '~data/hooks'

/** What a detail page can be missing; each gets whole sentences, so every language can agree its words. */
export type MissingKind = 'process' | 'transition'

/**
 * What a detail page shows when its entity is not in the store: a skeleton
 * until the indexer has finished its first poll, "not found" after.
 */
export function MissingEntity({ what, id }: { what: MissingKind; id?: string }) {
  const { t } = useLingui()
  const { status } = useIndexer()
  // Until the first poll completes the entity may still arrive.
  if (status.phase === 'idle' || status.phase === 'loading' || status.scanning) {
    return <SkeletonText lines={6} className='max-w-2xl' />
  }
  if (what === 'transition') {
    return (
      <EmptyState
        title={t`No transition found`}
        description={id ? t`The registry has no transition ${id}.` : t`The registry has no such transition.`}
      />
    )
  }
  return (
    <EmptyState
      title={t`No process found`}
      description={id ? t`The registry has no process ${id}.` : t`The registry has no such process.`}
    />
  )
}
