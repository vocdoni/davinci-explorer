import { useEffect, type ComponentType } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Card, ChevronLeftIcon, ChevronRightIcon, EmptyState, SectionHeader, Select, Stack } from '~kit'
import { cn } from '~lib/cn'
import { paths } from '~routes/paths'
import { Blobs } from './content/Blobs'
import { Census } from './content/Census'
import { Glossary } from './content/Glossary'
import { HowItWorks } from './content/HowItWorks'
import { KeyModes } from './content/KeyModes'
import { Results } from './content/Results'
import { Settlement } from './content/Settlement'
import { SilentRevoting } from './content/SilentRevoting'
import { VerifyAuditor } from './content/VerifyAuditor'
import { VerifyOrganizer } from './content/VerifyOrganizer'
import { VerifyVoter } from './content/VerifyVoter'
import { useLearnExamples, type LearnExamples } from './examples'
import { TOPIC_GROUPS, TOPICS, findTopic, neighbours, type TopicMeta } from './topics'

const CONTENT: Record<string, ComponentType<{ ex: LearnExamples }>> = {
  'how-it-works': HowItWorks,
  'key-modes': KeyModes,
  census: Census,
  'silent-revoting': SilentRevoting,
  blobs: Blobs,
  settlement: Settlement,
  results: Results,
  'verify-voter': VerifyVoter,
  'verify-organizer': VerifyOrganizer,
  'verify-auditor': VerifyAuditor,
  glossary: Glossary,
}

/** `/learn` (the index) and `/learn/:topic`. */
export function LearnPage() {
  const { topic } = useParams()
  const { hash } = useLocation()
  const meta = findTopic(topic)

  // A deep link (#term-vote-id, #ballot-slots) lands once the topic has rendered.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [topic, hash])

  return (
    <Stack data-testid='page-learn'>
      {!topic ? <LearnIndex /> : meta ? <TopicPage meta={meta} /> : <UnknownTopic slug={topic} />}
    </Stack>
  )
}

const ROLES: Array<{ slug: string; who: MessageDescriptor; text: MessageDescriptor }> = [
  {
    slug: 'verify-voter',
    who: msg`I voted`,
    text: msg`Find the transition that included your vote, check its tracker proof and see it counted.`,
  },
  {
    slug: 'verify-organizer',
    who: msg`I run a process`,
    text: msg`Check what the registry stored, the key, the batches as they settle and the results.`,
  },
  {
    slug: 'verify-auditor',
    who: msg`I audit the deployment`,
    text: msg`The pinned keys, every transition, the data behind it and the results, without trusting a sequencer.`,
  },
]

function LearnIndex() {
  const { i18n, t } = useLingui()
  return (
    <>
      <SectionHeader
        size='page'
        label={t`Learn`}
        title={t`How DAVINCI works`}
        description={t`A guide to what this explorer shows: how votes become a proven tally, whom each part trusts, and how to check every step yourself.`}
      />

      <Card data-testid='learn-summary'>
        <h2 className='text-[15px] font-semibold text-ghost'>
          <Trans>In short</Trans>
        </h2>
        <div className='mt-2 grid gap-x-10 gap-y-3 text-[14px] leading-[1.7] text-pewter lg:grid-cols-2'>
          <p>
            <Trans>
              Voters encrypt their ballots and prove in zero knowledge that each one is valid. Sequencers group the
              ballots into batches, and a single zkVM program proves everything about a batch at once: every ballot
              proof, every signature, census membership, the updated state and the encrypted tally.
            </Trans>
          </p>
          <p>
            <Trans>
              Each batch settles on the ProcessRegistry contract with its proof and the EIP-4844 blobs that publish what
              changed, so anyone can rebuild the state. At the end the protocol decrypts only the final encrypted sum,
              by the sequencer that holds the key or by a DKG committee, and that step is proven too.
            </Trans>
          </p>
        </div>
        <Link
          to={paths.learn('how-it-works')}
          className='mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-emerald hover:underline'
        >
          <Trans>The full walk-through</Trans> <ChevronRightIcon size={14} />
        </Link>
      </Card>

      <section aria-labelledby='learn-roles'>
        <h2 id='learn-roles' className='label-caps mb-3 text-[11px] text-pewter'>
          <Trans>Check it yourself</Trans>
        </h2>
        <div className='grid gap-4 md:grid-cols-3'>
          {ROLES.map((r) => (
            <Link
              key={r.slug}
              to={paths.learn(r.slug)}
              className='group rounded-md border border-charcoal bg-carbon p-5 transition-colors hover:border-emerald/50'
            >
              <div className='text-[15px] font-semibold text-ghost group-hover:text-emerald'>{i18n._(r.who)}</div>
              <p className='mt-1.5 text-[13px] leading-relaxed text-ash'>{i18n._(r.text)}</p>
            </Link>
          ))}
        </div>
      </section>

      {TOPIC_GROUPS.filter((g) => g.id !== 'verify').map((g) => (
        <section key={g.id} aria-labelledby={`learn-${g.id}`}>
          <h2 id={`learn-${g.id}`} className='label-caps mb-3 text-[11px] text-pewter'>
            {i18n._(g.label)}
          </h2>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {TOPICS.filter((topic) => topic.group === g.id).map((topic) => (
              <Link
                key={topic.slug}
                to={paths.learn(topic.slug)}
                data-testid={`topic-card-${topic.slug}`}
                className='group flex flex-col rounded-md border border-charcoal bg-carbon p-5 transition-colors hover:border-emerald/50'
              >
                <span className='text-[14px] font-semibold text-ghost group-hover:text-emerald'>
                  {i18n._(topic.title)}
                </span>
                <span className='mt-1.5 text-[13px] leading-relaxed text-ash'>{i18n._(topic.summary)}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function TopicNav({ current }: { current: string }) {
  const { i18n, t } = useLingui()
  return (
    <nav aria-label={t`Guide topics`} className='flex flex-col gap-5'>
      {TOPIC_GROUPS.map((g) => (
        <div key={g.id}>
          <div className='label-caps mb-1.5 text-[11px] text-pewter'>{i18n._(g.label)}</div>
          <ul className='flex flex-col'>
            {TOPICS.filter((topic) => topic.group === g.id).map((topic) => (
              <li key={topic.slug}>
                <Link
                  to={paths.learn(topic.slug)}
                  aria-current={topic.slug === current ? 'page' : undefined}
                  className={cn(
                    '-ml-3 block border-l-2 py-1 pl-3 text-[13px] transition-colors',
                    topic.slug === current
                      ? 'border-emerald text-emerald'
                      : 'border-transparent text-ash hover:border-charcoal hover:text-ghost'
                  )}
                >
                  {i18n._(topic.title)}
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
        <div className='sticky top-20'>
          <Link to={paths.learn()} className='mb-5 block text-[13px] text-pewter hover:text-emerald'>
            ← <Trans>All topics</Trans>
          </Link>
          <TopicNav current={meta.slug} />
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
