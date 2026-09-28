import { useLingui } from '@lingui/react/macro'
import { EmptyState, SkeletonText } from '~kit'
import { useIndexer } from '~data/hooks'

/** What a detail page is missing, with what identifies it; each kind gets whole sentences, so every language can agree its words. */
export type MissingEntityProps =
  | { what: 'process'; id?: string }
  | { what: 'transition'; index?: string; processId?: string }
  | { what: 'sequencer'; id?: string }

/**
 * What a detail page shows when its entity is not in the store: a skeleton
 * until the indexer has finished its first poll, "not found" after.
 */
export function MissingEntity(props: MissingEntityProps) {
  const { t } = useLingui()
  const { status } = useIndexer()
  // Until the first poll completes the entity may still arrive.
  if (status.phase === 'idle' || status.phase === 'loading' || status.scanning) {
    return <SkeletonText lines={6} className='max-w-2xl' />
  }
  if (props.what === 'transition') {
    const { index, processId } = props
    return (
      <EmptyState
        title={t`No transition found`}
        description={
          index && processId
            ? t`The registry has no transition #${index} of process ${processId}.`
            : t`The registry has no such transition.`
        }
      />
    )
  }
  if (props.what === 'sequencer') {
    const { id } = props
    return (
      <EmptyState
        title={t`No sequencer found`}
        description={
          id
            ? t`No account ${id} settled a transition or published results on this registry, and no configured sequencer API reports it.`
            : t`The registry knows no such sequencer.`
        }
      />
    )
  }
  const { id } = props
  return (
    <EmptyState
      title={t`No process found`}
      description={id ? t`The registry has no process ${id}.` : t`The registry has no such process.`}
    />
  )
}
