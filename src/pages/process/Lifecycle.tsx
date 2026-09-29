import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Timestamp, TxLink } from '~components'
import { useChainNow, type ProcessView } from '~data/hooks'
import { Card } from '~kit'
import { cn } from '~lib/cn'
import { useCreation } from './ending'
import { processLifecycle, type StepState } from './timeline'

const DOT: Record<StepState, string> = {
  done: 'bg-emerald border-emerald',
  current: 'bg-transparent border-emerald ring-4 ring-emerald/15',
  upcoming: 'bg-transparent border-warm-gray',
  skipped: 'bg-transparent border-charcoal',
}

const STATE_LABEL: Record<StepState, MessageDescriptor> = {
  done: msg`done`,
  current: msg`in progress`,
  upcoming: msg`not yet`,
  skipped: msg`skipped`,
}

/** created → start → batches → end → grace window → results, as a strip (a list on a phone). */
export function Lifecycle({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const now = useChainNow()
  const creation = useCreation(view.process)
  const steps = processLifecycle(view, now, creation?.initialDuration ?? null)
  return (
    <Card data-testid='process-lifecycle' className='px-5 py-4'>
      <ol className='grid gap-4 md:grid-cols-6 md:gap-2' aria-label={t`Process lifecycle`}>
        {steps.map((step, i) => (
          <li key={step.id} className='relative flex items-start gap-3 md:flex-col md:gap-2'>
            <div className='relative mt-1 flex items-center md:mt-0 md:w-full'>
              <span
                aria-label={i18n._(STATE_LABEL[step.state])}
                role='img'
                className={cn('z-10 h-3 w-3 shrink-0 rounded-full border-2', DOT[step.state])}
              />
              {i < steps.length - 1 ? (
                <span
                  aria-hidden='true'
                  className={cn(
                    'absolute top-1.5 left-3 hidden h-px w-[calc(100%-4px)] md:block',
                    step.state === 'done' ? 'bg-emerald/50' : 'bg-charcoal'
                  )}
                />
              ) : null}
            </div>
            <div className='min-w-0 md:pr-3'>
              <div
                className={cn(
                  'text-[13px] font-medium',
                  step.state === 'skipped' ? 'text-ash' : step.state === 'upcoming' ? 'text-pewter' : 'text-ghost'
                )}
              >
                {step.label}
              </div>
              <div className='text-xs text-ash'>{step.detail}</div>
              {step.time != null ? (
                <div>
                  {/* A step that will not happen (a start after a cancel) gets its date, not a countdown. */}
                  <Timestamp
                    value={step.time}
                    relative={!(step.state === 'skipped' && now != null && step.time > now)}
                    className='text-xs text-silver'
                  />
                </div>
              ) : null}
              {step.tx ? (
                <div className='-ml-0.5'>
                  <TxLink hash={step.tx} chars={4} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
