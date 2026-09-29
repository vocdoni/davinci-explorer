import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { CheckMark } from '~components'
import { Formula } from '~components/Formula'
import { RichText } from '~components/RichText'
import { Address, Badge, Panel, Skeleton } from '~kit'
import { formatNumber } from '~lib/format'
import type { ContractRow, WiringCheck } from './model'
import { SourceLink, SubHeading, TechnicalToggle } from './parts'

export function AddressesPanel({
  rows,
  checks,
  technical = false,
  onTechnical,
}: {
  rows: ContractRow[]
  checks: WiringCheck[]
  /** Show each contract's mechanism and each check's exact relation. */
  technical?: boolean
  onTechnical?: (on: boolean) => void
}) {
  const { i18n, t } = useLingui()
  const passed = checks.filter((c) => c.state === 'pass').length
  const total = formatNumber(checks.length)
  return (
    <Panel
      title={t`Addresses`}
      label={t`Contracts`}
      description={t`Every contract this deployment uses, with a link to its code on the block explorer. Before trusting the rest of this page, compare that code with the published repositories.`}
      actions={onTechnical ? <TechnicalToggle checked={technical} onChange={onTechnical} /> : undefined}
    >
      <ul className='-my-3 divide-y divide-charcoal'>
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid={`contract-row-${row.id}`}
            className='flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between md:gap-8'
          >
            <div className='min-w-0 md:max-w-[62%]'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-[13px] font-semibold text-ghost'>{row.name}</span>
                {row.group === 'dkg' ? (
                  <Badge size='sm' tone='neutral'>
                    davinci-dkg
                  </Badge>
                ) : null}
              </div>
              <p className='mt-0.5 text-[12px] leading-relaxed text-pewter'>{i18n._(row.role)}</p>
              {technical && row.detail ? (
                <p className='mt-0.5 text-[12px] leading-relaxed text-ash'>
                  <RichText text={i18n._(row.detail)} />
                </p>
              ) : null}
            </div>
            <div className='flex min-w-0 shrink-0 items-center gap-2'>
              {row.address ? (
                <>
                  <Address value={row.address} chars={6} />
                  <SourceLink address={row.address} />
                </>
              ) : row.note ? (
                <span className='text-[12px] text-ash md:max-w-xs md:text-right'>{i18n._(row.note)}</span>
              ) : (
                <Skeleton className='h-4 w-44' />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className='mt-6 border-t border-charcoal pt-5' data-testid='wiring-checks'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <SubHeading>
            <Trans>How the contracts point at each other</Trans>
          </SubHeading>
          <span className='text-[12px] text-ash'>
            <Plural value={passed} one={`# of ${total} consistent`} other={`# of ${total} consistent`} />
          </span>
        </div>
        <p className='mt-1 text-[12px] leading-relaxed text-ash'>
          <Trans>
            Each contract is asked which others it works with, so a copied address or a registry connected to the wrong
            committee shows up here.
          </Trans>
        </p>
        <ul className='mt-3 flex flex-col gap-2.5'>
          {checks.map((c) => (
            <li key={c.id} className='flex items-start gap-2.5' data-testid={`wiring-${c.id}`}>
              <CheckMark state={c.state} className='mt-0.5' />
              <div className='min-w-0'>
                <div className='text-[13px] text-silver'>{i18n._(c.label)}</div>
                <div className='text-[12px] break-words text-ash'>{i18n._(c.detail)}</div>
                {technical ? (
                  <div className='mt-1 text-[12px]'>
                    <Formula expr={c.formula} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
