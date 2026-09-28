// The frame every Verify flow shares: the header with its question, the
// stepper (1 Choose · 2 Check · 3 Redo it yourself), numbered sections, and
// the closing "what this proves, and what it doesn't".

import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { HashLink } from '~components/HashLink'
import { CheckIcon, Stack } from '~kit'
import { cn } from '~lib/cn'
import { paths } from '~routes/paths'
import { DashIcon } from './icons'
import type { StepId, StepState } from './status'

const STEP_LABELS: Record<StepId, MessageDescriptor> = {
  choose: msg`Choose`,
  check: msg`Check`,
  redo: msg`Redo it yourself`,
}
const STEP_ORDER: StepId[] = ['choose', 'check', 'redo']

function Stepper({ states, hints }: { states: Record<StepId, StepState>; hints: Partial<Record<StepId, ReactNode>> }) {
  const { i18n, t } = useLingui()
  return (
    <nav aria-label={t`Steps`} data-testid='verify-stepper'>
      <ol className='flex items-stretch gap-2 sm:gap-3'>
        {STEP_ORDER.map((id, i) => {
          const state = states[id]
          return (
            <li key={id} className='flex min-w-0 flex-1 items-center gap-2 sm:gap-3'>
              <HashLink
                id={id}
                className={cn(
                  'group flex min-w-0 flex-1 items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors sm:px-3',
                  state === 'current'
                    ? 'border-emerald/50 bg-emerald/8'
                    : 'border-charcoal bg-carbon hover:border-warm-gray'
                )}
              >
                <span
                  aria-hidden='true'
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[12px]',
                    state === 'done'
                      ? 'border-emerald bg-emerald text-on-accent'
                      : state === 'current'
                        ? 'border-emerald text-emerald'
                        : 'border-charcoal text-ash'
                  )}
                >
                  {state === 'done' ? <CheckIcon size={12} /> : i + 1}
                </span>
                <span className='min-w-0'>
                  <span
                    className={cn(
                      'block text-[12px] leading-tight font-semibold sm:text-[13px]',
                      state === 'upcoming' ? 'text-pewter' : 'text-ghost'
                    )}
                    aria-current={state === 'current' ? 'step' : undefined}
                  >
                    {i18n._(STEP_LABELS[id])}
                  </span>
                  {hints[id] ? (
                    <span className='mt-0.5 hidden truncate text-[11px] text-ash sm:block'>{hints[id]}</span>
                  ) : null}
                </span>
              </HashLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Header, stepper and the sections of one flow. */
export function FlowFrame({
  testId,
  flow,
  icon,
  question,
  description,
  states,
  hints = {},
  children,
}: {
  testId: string
  /** The flow's short name, for the breadcrumb: "My vote". */
  flow: ReactNode
  icon: ReactNode
  /** The question the flow answers, as the page title. */
  question: ReactNode
  description: ReactNode
  states: Record<StepId, StepState>
  hints?: Partial<Record<StepId, ReactNode>>
  children: ReactNode
}) {
  const { t } = useLingui()
  return (
    <Stack data-testid={testId} className='gap-8'>
      <header className='flex flex-col gap-3'>
        <nav aria-label={t`Breadcrumb`} className='label-caps flex items-center gap-2 text-emerald'>
          <Link to={paths.verify()} className='hover:underline'>
            <Trans>Verify</Trans>
          </Link>
          <span aria-hidden='true' className='text-ash'>
            /
          </span>
          <span className='text-pewter'>{flow}</span>
        </nav>
        <div className='flex items-start gap-4'>
          <span
            aria-hidden='true'
            className='hidden h-12 w-12 shrink-0 items-center justify-center rounded-md border border-emerald/30 bg-emerald/10 text-emerald sm:flex'
          >
            {icon}
          </span>
          <div className='min-w-0'>
            <h1 className='text-[28px] leading-tight font-semibold tracking-tight text-ghost'>{question}</h1>
            <p className='mt-2 max-w-3xl text-[14px] leading-relaxed text-ash'>{description}</p>
          </div>
        </div>
      </header>
      <Stepper states={states} hints={hints} />
      {children}
    </Stack>
  )
}

/** One numbered step of a flow; its id is the stepper's anchor. */
export function FlowSection({
  id,
  n,
  title,
  description,
  aside,
  children,
}: {
  id: StepId
  n: number
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className='flex scroll-mt-20 flex-col gap-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='min-w-0'>
          <h2
            id={`${id}-title`}
            className='flex items-center gap-3 text-[20px] font-semibold tracking-tight text-ghost'
          >
            <span
              aria-hidden='true'
              className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald/12 font-mono text-[13px] text-emerald'
            >
              {n}
            </span>
            {title}
          </h2>
          {description ? (
            <p className='mt-1.5 max-w-3xl text-[14px] leading-relaxed text-ash sm:pl-10'>{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className='min-w-0 sm:pl-10'>{children}</div>
    </section>
  )
}

/** "What this proves, and what it doesn't": plain, honest, with the long explanations one click away. */
export function ProvesPanel({
  proves,
  doesNot,
  children,
  testId,
}: {
  proves: ReactNode[]
  doesNot: ReactNode[]
  /** Longer explanations, usually disclosures. */
  children?: ReactNode
  testId?: string
}) {
  return (
    <section
      id='limits'
      aria-labelledby='limits-title'
      className='flex scroll-mt-20 flex-col gap-4 border-t border-charcoal pt-8'
      data-testid={testId}
    >
      <h2 id='limits-title' className='text-[20px] font-semibold tracking-tight text-ghost'>
        <Trans>What this proves, and what it doesn’t</Trans>
      </h2>
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='rounded-md border border-emerald/25 bg-emerald/[0.04] p-5'>
          <h3 className='flex items-center gap-2 text-[14px] font-semibold text-ghost'>
            <span className='flex h-5 w-5 items-center justify-center rounded-full bg-emerald/15 text-emerald'>
              <CheckIcon size={11} />
            </span>
            <Trans>It proves</Trans>
          </h3>
          <ul className='mt-3 flex flex-col gap-2.5 text-[14px] leading-relaxed text-silver'>
            {proves.map((p, i) => (
              <li key={i} className='flex gap-2.5'>
                <CheckIcon size={14} className='mt-1 shrink-0 text-emerald' aria-hidden='true' />
                <span className='min-w-0'>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className='rounded-md border border-amber/25 bg-amber/[0.04] p-5'>
          <h3 className='flex items-center gap-2 text-[14px] font-semibold text-ghost'>
            <span className='flex h-5 w-5 items-center justify-center rounded-full bg-amber/15 text-amber'>
              <DashIcon size={11} />
            </span>
            <Trans>It does not prove</Trans>
          </h3>
          <ul className='mt-3 flex flex-col gap-2.5 text-[14px] leading-relaxed text-silver'>
            {doesNot.map((p, i) => (
              <li key={i} className='flex gap-2.5'>
                <DashIcon size={14} className='mt-1 shrink-0 text-amber' aria-hidden='true' />
                <span className='min-w-0'>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {children ? <div className='flex flex-col gap-2'>{children}</div> : null}
    </section>
  )
}

/** Short prose inside a flow: 14 px, relaxed. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2 text-[14px] leading-relaxed text-ash', className)}>{children}</div>
}
