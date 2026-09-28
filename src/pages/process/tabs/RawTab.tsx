import { useMemo, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import type { ProcessView } from '~data/hooks'
import { CopyButton, Panel } from '~kit'
import { formatNumber } from '~lib/format'
import { toJson } from '../json'

function JsonPanel({
  title,
  description,
  json,
  testId,
}: {
  title: string
  description: ReactNode
  json: string
  testId: string
}) {
  const { t } = useLingui()
  return (
    <Panel
      title={title}
      label='JSON'
      description={description}
      actions={
        <span className='inline-flex items-center gap-1 text-[12px] text-ash'>
          <Trans>Copy</Trans> <CopyButton value={json} label={t`Copy ${title}`} />
        </span>
      }
      bodyClassName='p-0'
    >
      <pre
        data-testid={testId}
        className='max-h-[520px] overflow-auto p-5 text-[11px] leading-relaxed text-silver scroll-slim'
      >
        {json}
      </pre>
    </Panel>
  )
}

/** The contract state and the indexed entity, as they are; bigints as decimal strings. */
export function RawTab({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const p = view.process
  const state = useMemo(() => toJson(p.state), [p.state])
  const entity = useMemo(() => toJson(p), [p])
  const pid = p.id.slice(0, 10)
  const block = formatNumber(p.stateBlock)
  return (
    <div data-testid='tab-raw' className='flex flex-col gap-6'>
      <JsonPanel
        title='getProcess'
        testId='raw-state'
        json={state}
        description={
          p.stateBlock
            ? t`The registry’s getProcess(${pid}…) read at block ${block}, with field names normalised: enums as names, the DKG fields grouped under dkg.`
            : t`Not read yet.`
        }
      />
      <JsonPanel
        title={t`Indexed entity`}
        testId='raw-entity'
        json={entity}
        description={t`Everything the explorer derived for this process from the registry events: creation, transitions (keys), status, duration, max-voter and census changes, results and the decryption request.`}
      />
    </div>
  )
}
