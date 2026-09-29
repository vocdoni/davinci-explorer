// The checklist every Verify flow ends in: one card per check with its
// outcome, one plain sentence, and "How this is checked" one click away.

import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { CodeBlock, Disclosure } from '~components/code'
import { Badge, CheckIcon, CloseIcon, WarningIcon, type BadgeTone } from '~kit'
import { cn } from '~lib/cn'
import { ClockIcon, DashIcon } from './icons'
import { countStatuses, type VerifyStatus } from './status'

const STATUS: Record<
  VerifyStatus,
  { label: MessageDescriptor; tone: BadgeTone; disc: string; rail: string; bar: string }
> = {
  pass: {
    label: msg`Passed`,
    tone: 'ok',
    disc: 'border-emerald/35 bg-emerald/12 text-emerald',
    rail: 'before:bg-emerald',
    bar: 'bg-emerald',
  },
  fail: {
    label: msg`Failed`,
    tone: 'danger',
    disc: 'border-red/35 bg-red/12 text-red',
    rail: 'before:bg-red',
    bar: 'bg-red',
  },
  attention: {
    label: msg`Attention`,
    tone: 'warn',
    disc: 'border-amber/35 bg-amber/12 text-amber',
    rail: 'before:bg-amber',
    bar: 'bg-amber',
  },
  pending: {
    label: msg`Pending`,
    tone: 'info',
    disc: 'border-blue/35 bg-blue/12 text-blue',
    rail: 'before:bg-blue',
    bar: 'bg-blue',
  },
  na: {
    label: msg`Not applicable`,
    tone: 'neutral',
    disc: 'border-charcoal bg-onyx text-ash',
    rail: 'before:bg-charcoal',
    bar: 'bg-warm-gray',
  },
}

/** The round status mark of a check: ✓, ✗, a warning sign, a clock or a dash, with its name for screen readers. */
export function StatusDisc({ status, size = 'md' }: { status: VerifyStatus; size?: 'sm' | 'md' }) {
  const { i18n } = useLingui()
  const s = STATUS[status]
  const icon = size === 'sm' ? 11 : 15
  return (
    <span
      role='img'
      aria-label={i18n._(s.label)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border',
        size === 'sm' ? 'h-5 w-5' : 'h-8 w-8',
        s.disc
      )}
    >
      {status === 'pass' ? (
        <CheckIcon size={icon} />
      ) : status === 'fail' ? (
        <CloseIcon size={icon} />
      ) : status === 'attention' ? (
        <WarningIcon size={icon} />
      ) : status === 'pending' ? (
        <ClockIcon size={icon} />
      ) : (
        <DashIcon size={icon} />
      )}
    </span>
  )
}

export function StatusBadge({ status, label }: { status: VerifyStatus; label?: string }) {
  const { i18n } = useLingui()
  return <Badge tone={STATUS[status].tone}>{label ?? i18n._(STATUS[status].label)}</Badge>
}

export interface CheckCardProps {
  /** `data-testid` is `check-<id>`. */
  id: string
  status: VerifyStatus
  /** What is checked, as a plain statement: "Your vote was settled on-chain". */
  title: ReactNode
  /** The badge text when the generic one says too little ("Not found", "Not yet"). */
  statusLabel?: string
  /** One plain sentence: what the outcome means for the reader. */
  summary: ReactNode
  /** Anything the reader should see without opening the details. */
  children?: ReactNode
  /** The technical side: mechanism, values compared, the command. */
  how?: ReactNode
}

/** One check: its outcome, what it means, and how it is checked. */
export function CheckCard({ id, status, title, statusLabel, summary, children, how }: CheckCardProps) {
  const { t } = useLingui()
  return (
    <li
      data-testid={`check-${id}`}
      data-status={status}
      className={cn(
        'relative overflow-hidden rounded-md border border-charcoal bg-carbon',
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        STATUS[status].rail
      )}
    >
      <div className='p-4 pl-5 sm:p-5 sm:pl-6'>
        {/* On a phone the body takes the card's full width; from sm up it lines up under the title. */}
        <div className='flex items-start gap-3 sm:gap-4'>
          <StatusDisc status={status} />
          <div className='flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
            <h3 className='pt-1 text-[15px] leading-snug font-semibold text-ghost'>{title}</h3>
            <div className='shrink-0 sm:pt-1'>
              <StatusBadge status={status} label={statusLabel} />
            </div>
          </div>
        </div>
        <div className='mt-2 sm:mt-1 sm:pl-12'>
          <div className='text-[14px] leading-relaxed text-silver'>{summary}</div>
          {children ? <div className='mt-3'>{children}</div> : null}
          {how ? (
            <Disclosure summary={t`How this is checked`} variant='plain' className='mt-3'>
              <div className='flex flex-col gap-4 rounded-sm border border-charcoal bg-obsidian/40 p-3 text-[13px] leading-relaxed text-ash sm:p-4'>
                {how}
              </div>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** A titled run of checks. */
export function CheckGroup({
  title,
  description,
  children,
  testId,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section className='flex flex-col gap-3' data-testid={testId}>
      <div>
        <h3 className='label-caps text-[12px] text-pewter'>{title}</h3>
        {description ? <p className='mt-1 text-[13px] leading-relaxed text-ash'>{description}</p> : null}
      </div>
      <ul className='flex flex-col gap-3'>{children}</ul>
    </section>
  )
}

/** A labelled block inside "How this is checked". */
export function HowPart({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className='min-w-0'>
      <div className='label-caps mb-1.5 text-[11px] text-pewter'>{title}</div>
      <div className='flex min-w-0 flex-col gap-2'>{children}</div>
    </div>
  )
}

/** The values a check compares, label then value. */
export function Compared({ rows }: { rows: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <dl className='grid min-w-0 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)]'>
      {rows.map((r, i) => (
        <div key={i} className='contents'>
          <dt className='text-[12px] text-pewter'>{r.label}</dt>
          <dd className='min-w-0 text-[12px] break-words text-silver'>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The command that redoes a check, with a copy button. */
export function RedoCommand({ code, label, note }: { code: string; label?: string; note?: ReactNode }) {
  const { t } = useLingui()
  return (
    <HowPart title={t`Redo it yourself`}>
      {note ? <p>{note}</p> : null}
      <CodeBlock code={code} label={label ?? t`Copy the command`} maxHeight={260} />
    </HowPart>
  )
}

/** The verdict over a whole checklist, with a bar of the outcomes. */
export function ChecklistSummary({ statuses, testId }: { statuses: VerifyStatus[]; testId?: string }) {
  const { t } = useLingui()
  const c = countStatuses(statuses)
  const total = statuses.length
  const applicable = total - c.na
  const decided = c.pass + c.fail + c.attention
  const overall: VerifyStatus =
    c.fail > 0 ? 'fail' : c.pending > 0 ? 'pending' : c.attention > 0 ? 'attention' : c.pass > 0 ? 'pass' : 'na'
  const pass = c.pass
  const fail = c.fail
  const attention = c.attention
  const pending = c.pending
  const na = c.na
  const text =
    overall === 'fail'
      ? t`${plural(fail, { one: '# check failed', other: '# checks failed' })}, of ${applicable} that apply.`
      : overall === 'pending'
        ? t`${decided} of ${applicable} checks decided so far; the others are still being read or wait for something to happen.`
        : overall === 'attention'
          ? t`${plural(attention, { one: 'Nothing failed, but # check needs your attention.', other: 'Nothing failed, but # checks need your attention.' })}`
          : overall === 'pass'
            ? pass === applicable && na === 0
              ? t`${plural(pass, { one: 'The check passed.', other: 'All # checks passed.' })}`
              : t`${plural(pass, { one: 'The check that applies passed.', other: 'All # checks that apply passed.' })}`
            : t`None of these checks applies yet.`
  return (
    <div
      data-testid={testId}
      data-status={overall}
      className='flex flex-col gap-3 rounded-md border border-charcoal bg-carbon p-4 sm:flex-row sm:items-center sm:gap-4'
    >
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        <StatusDisc status={overall} />
        <p className='text-[14px] font-medium text-ghost'>{text}</p>
      </div>
      <div className='flex shrink-0 flex-col gap-1.5 sm:w-64'>
        <div className='flex h-1.5 overflow-hidden rounded-pill bg-onyx' aria-hidden='true'>
          {(['pass', 'attention', 'fail', 'pending', 'na'] as const).map((s) =>
            c[s] > 0 ? <span key={s} className={STATUS[s].bar} style={{ width: `${(c[s] / total) * 100}%` }} /> : null
          )}
        </div>
        <p className='text-[11px] text-ash'>
          {attention > 0 ? (
            <Trans>
              {pass} passed · {attention} to note · {fail} failed · {pending} pending · {na} not applicable
            </Trans>
          ) : (
            <Trans>
              {pass} passed · {fail} failed · {pending} pending · {na} not applicable
            </Trans>
          )}
        </p>
      </div>
    </div>
  )
}
