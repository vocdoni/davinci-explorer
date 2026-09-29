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
            ? t`What the registry returns for this process, getProcess(${pid}…), read at block ${block}. The field names are tidied up: enums as names, the DKG fields grouped under dkg.`
            : t`Not read yet.`
        }
      />
      <JsonPanel
        title={t`Indexed entity`}
        testId='raw-entity'
        json={entity}
        description={t`Everything the explorer built for this process from the registry’s events: creation, transitions (by key), status, duration, voter-limit and census changes, results and the decryption request.`}
      />
    </div>
  )
}
