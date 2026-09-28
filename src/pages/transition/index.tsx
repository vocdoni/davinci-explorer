import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useParams } from 'react-router'
import { HashLink, MissingEntity, ProcessIdLink } from '~components'
import { useChainNow, useTransition, useTransitions } from '~data/hooks'
import { useTransitionBlobs } from '~data/queries'
import { buttonClasses, ChevronLeftIcon, ChevronRightIcon, SectionHeader, Stack } from '~kit'
import { cn } from '~lib/cn'
import { paths } from '~routes/paths'
import { BlobsPanel } from './BlobsPanel'
import { ProofPanel } from './ProofPanel'
import { PublicsPanel } from './PublicsPanel'
import { TransitionSummary } from './Summary'
import { VerifyPanel } from './VerifyPanel'

const SECTIONS: Array<[string, MessageDescriptor]> = [
  ['publics', msg`Public values`],
  ['blobs', msg`Blobs`],
  ['proof', msg`Proof`],
  ['verify', msg`Verify it yourself`],
]

/**
 * One settled batch: its facts, the proof's public values, the blobs that
 * carry its data, the proof, and every check the registry ran with the
 * commands to rerun it.
 */
export function TransitionPage() {
  const { i18n, t } = useLingui()
  const { pid, index: param } = useParams()
  const i = param != null && /^\d+$/.test(param) ? Number(param) : undefined
  const detail = useTransition(pid, i)
  const all = useTransitions(pid)
  const blobs = useTransitionBlobs(pid, i)
  const now = useChainNow()

  if (!pid || i == null || !detail) {
    const number = param ?? ''
    const processId = pid ?? ''
    const id = t({
      message: `#${number} of process ${processId}`,
      comment: 'Fills {id} in "The registry has no transition {id}."',
    })
    return <MissingEntity what='transition' id={id} />
  }
  const { previous, next, process } = detail
  const index = detail.transition.index
  // Shown on the disabled step buttons at either end of the process's transitions.
  const previousLabel = previous ? `#${previous.index}` : t({ message: 'First', comment: 'The first transition' })
  const nextLabel = next ? `#${next.index}` : t({ message: 'Latest', comment: 'The latest transition' })

  const nav = (to: number | null, label: string, dir: 'prev' | 'next') =>
    to == null ? (
      <span className={cn(buttonClasses('secondary', 'sm'), 'pointer-events-none opacity-40')} aria-disabled='true'>
        {dir === 'prev' ? <ChevronLeftIcon size={13} /> : null}
        {label}
        {dir === 'next' ? <ChevronRightIcon size={13} /> : null}
      </span>
    ) : (
      <Link to={paths.transition(process.id, to)} className={buttonClasses('secondary', 'sm')} rel={dir}>
        {dir === 'prev' ? <ChevronLeftIcon size={13} /> : null}
        {label}
        {dir === 'next' ? <ChevronRightIcon size={13} /> : null}
      </Link>
    )

  return (
    <Stack data-testid='page-transition'>
      <SectionHeader
        size='page'
        label={t`State transition`}
        title={t`Transition #${index}`}
        description={
          <Trans>
            One batch of ballots for process <ProcessIdLink id={process.id} chars={8} />, proven by the zkVM and settled
            on the registry: its public values, the blobs carrying its data and the checks the registry ran.
          </Trans>
        }
        actions={
          <>
            {nav(previous?.index ?? null, previousLabel, 'prev')}
            {nav(next?.index ?? null, nextLabel, 'next')}
          </>
        }
      />
      <TransitionSummary detail={detail} blobs={blobs} now={now} total={all.length} />
      <nav aria-label={t`Sections`} className='-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]'>
        {SECTIONS.map(([id, label]) => (
          <HashLink key={id} id={id} className='text-ash transition-colors hover:text-emerald'>
            {i18n._(label)}
          </HashLink>
        ))}
      </nav>
      <section id='publics' className='scroll-mt-20'>
        <PublicsPanel detail={detail} />
      </section>
      <section id='blobs' className='scroll-mt-20'>
        <BlobsPanel detail={detail} blobs={blobs} />
      </section>
      <section id='proof' className='scroll-mt-20'>
        <ProofPanel detail={detail} />
      </section>
      <section id='verify' className='scroll-mt-20'>
        <VerifyPanel detail={detail} />
      </section>
    </Stack>
  )
}
