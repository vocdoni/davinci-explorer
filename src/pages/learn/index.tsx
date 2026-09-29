import { useEffect, type ComponentType } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Card, ChevronLeftIcon, ChevronRightIcon, EmptyState, SectionHeader, Select, Stack } from '~kit'
import { cn } from '~lib/cn'
import { paths } from '~routes/paths'
import { RedirectTo } from '~routes/redirects'
import { Blobs } from './content/Blobs'
import { Census } from './content/Census'
import { Glossary } from './content/Glossary'
import { HowItWorks } from './content/HowItWorks'
import { KeyModes } from './content/KeyModes'
import { Results } from './content/Results'
import { Settlement } from './content/Settlement'
import { SilentRevoting } from './content/SilentRevoting'
import { useLearnExamples, type LearnExamples } from './examples'
import { MOVED_TOPICS, TOPIC_GROUPS, TOPICS, findTopic, neighbours, type TopicMeta } from './topics'

const CONTENT: Record<string, ComponentType<{ ex: LearnExamples }>> = {
  'how-it-works': HowItWorks,
  'key-modes': KeyModes,
  census: Census,
  'silent-revoting': SilentRevoting,
  blobs: Blobs,
  settlement: Settlement,
  results: Results,
  glossary: Glossary,
}

/** `/learn/:topic`, and `/learn`, which opens on the first topic. */
export function LearnPage() {
  const { topic } = useParams()
  const { hash } = useLocation()
  const meta = topic ? findTopic(topic) : TOPICS[0]!

  // A deep link (#term-vote-id, #ballot-slots) lands once the topic has rendered.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [topic, hash])

  if (topic && MOVED_TOPICS[topic]) return <RedirectTo to={MOVED_TOPICS[topic]} />
  return <Stack data-testid='page-learn'>{meta ? <TopicPage meta={meta} /> : <UnknownTopic slug={topic!} />}</Stack>
}

function TopicNav({ current }: { current: string }) {
  const { i18n, t } = useLingui()
  return (
    <nav aria-label={t`Guide topics`} className='flex flex-col gap-5'>
      {TOPIC_GROUPS.map((g) => (
        <div key={g.id}>
          <div className='label-caps mb-1.5 text-[11px] text-pewter'>{i18n._(g.label)}</div>
          <ul className='flex flex-col'>
            {TOPICS.filter((topic) => topic.group === g.id).map((topic, i) => (
              <li key={topic.slug}>
                <Link
                  to={paths.learn(topic.slug)}
                  aria-current={topic.slug === current ? 'page' : undefined}
                  className={cn(
                    '-ml-3 flex gap-2 border-l-2 py-1 pl-3 text-[13px] leading-snug transition-colors',
                    topic.slug === current
                      ? 'border-emerald text-emerald'
                      : 'border-transparent text-ash hover:border-charcoal hover:text-ghost'
                  )}
                >
                  {/* The walk-through reads in order; the reference does not. */}
                  {g.id === 'protocol' ? (
                    <span
                      aria-hidden='true'
                      className='w-3 shrink-0 text-right font-mono text-[11px] leading-[1.45] opacity-70'
                    >
                      {i + 1}
                    </span>
                  ) : null}
                  <span className='min-w-0'>{i18n._(topic.title)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function TopicPage({ meta }: { meta: TopicMeta }) {
  const { i18n, t } = useLingui()
  const ex = useLearnExamples()
  const navigate = useNavigate()
  const Content = CONTENT[meta.slug]!
  const { prev, next } = neighbours(meta.slug)
  const group = TOPIC_GROUPS.find((g) => g.id === meta.group)!
  return (
    <div className='grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]'>
      <aside className='hidden lg:block'>
        <div className='sticky top-20 flex flex-col gap-8'>
          <TopicNav current={meta.slug} />
          <CheckItYourself />
        </div>
      </aside>

      <article className='min-w-0 max-w-[780px]' data-testid='learn-topic' data-topic={meta.slug}>
        <div className='mb-6 lg:hidden'>
          <Select
            aria-label={t`Guide topic`}
            size='sm'
            value={meta.slug}
            onChange={(e) => navigate(paths.learn(e.target.value))}
            options={TOPICS.map((topic) => ({ value: topic.slug, label: i18n._(topic.title) }))}
          />
        </div>
        <SectionHeader
          size='page'
          label={
            <>
              <Link to={paths.learn()} className='hover:underline'>
                {t`Learn`}
              </Link>{' '}
              · {i18n._(group.label)}
            </>
          }
          title={i18n._(meta.title)}
          description={i18n._(meta.summary)}
        />
        <div className='mt-8'>
          <Content ex={ex} />
        </div>
        <nav
          aria-label={t`Next and previous topics`}
          className='mt-12 grid gap-3 border-t border-charcoal pt-6 sm:grid-cols-2'
        >
          {prev ? (
            <Link
              to={paths.learn(prev.slug)}
              className='group rounded-md border border-charcoal p-4 transition-colors hover:border-emerald/50'
            >
              <span className='flex items-center gap-1 text-[12px] text-ash'>
                <ChevronLeftIcon size={13} /> <Trans>Previous</Trans>
              </span>
              <span className='mt-1 block text-[13px] font-medium text-silver group-hover:text-emerald'>
                {i18n._(prev.title)}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={paths.learn(next.slug)}
              className='group rounded-md border border-charcoal p-4 text-right transition-colors hover:border-emerald/50'
            >
              <span className='flex items-center justify-end gap-1 text-[12px] text-ash'>
                <Trans>Next</Trans> <ChevronRightIcon size={13} />
              </span>
              <span className='mt-1 block text-[13px] font-medium text-silver group-hover:text-emerald'>
                {i18n._(next.title)}
              </span>
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  )
}

/** The way from reading about the checks to running them. */
function CheckItYourself() {
  return (
    <Link
      to={paths.verify()}
      className='group block rounded-md border border-emerald/30 bg-emerald/[0.05] p-4 transition-colors hover:border-emerald/60'
    >
      <span className='label-caps block text-[11px] text-emerald'>
        <Trans>Check it yourself</Trans>
      </span>
      <span className='mt-1.5 block text-[13px] leading-relaxed text-silver'>
        <Trans>Was your vote counted, was an election run correctly, is this the published code?</Trans>
      </span>
      <span className='mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-emerald'>
        <Trans>Verify</Trans>{' '}
        <ChevronRightIcon size={13} className='transition-transform group-hover:translate-x-0.5' />
      </span>
    </Link>
  )
}

function UnknownTopic({ slug }: { slug: string }) {
  const { i18n, t } = useLingui()
  return (
    <>
      <SectionHeader size='page' label={t`Learn`} title={t`No such topic`} />
      <Card>
        <EmptyState
          title={t`The guide has no topic “${slug}”`}
          description={t`It may have been renamed. These are the topics it has.`}
        />
        <ul className='mx-auto grid max-w-2xl gap-2 pb-4 sm:grid-cols-2'>
          {TOPICS.map((topic) => (
            <li key={topic.slug}>
              <Link to={paths.learn(topic.slug)} className='text-[13px] text-pewter hover:text-emerald'>
                {i18n._(topic.title)}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
