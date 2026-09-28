import type { ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { CheckMark, Explain } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import type { TransitionDetail } from '~indexer/selectors'
import { Address, Badge, Callout, Hash, Panel, SkeletonText, Tooltip } from '~kit'
import { bigIntToHex, formatNumber } from '~lib/format'
import { cn } from '~lib/cn'
import { BATCH_REGISTERS, failBits, type BatchPublics, type RegisterInfo } from '~protocol/publics'
import { FAIL_BIT_MEANINGS, READ_BY_LABEL, REGISTER_CHECK, REGISTER_NOTES } from './meaning'

const span = (r: RegisterInfo) => (r.span === 1 ? `${r.index}` : `${r.index}..${r.index + r.span - 1}`)

function flag(on: boolean, yes: string, no: string) {
  return (
    <Badge tone={on ? 'ok' : 'danger'} size='sm'>
      {on ? `1 · ${yes}` : `0 · ${no}`}
    </Badge>
  )
}

function RegisterValue({ r, p, csp }: { r: RegisterInfo; p: BatchPublics; csp: boolean }): ReactNode {
  const { t } = useLingui()
  switch (r.key) {
    case 'ok':
      return flag(p.ok, t`every check passed`, t`a check failed`)
    case 'failMask': {
      const names = failBits(p.failMask)
      return (
        <span className='font-mono text-[12px] text-ghost'>
          0x{p.failMask.toString(16).padStart(8, '0')}{' '}
          <span className={names.length ? 'text-red' : 'text-ash'}>
            {names.length ? names.join(', ') : t`no bit set`}
          </span>
        </span>
      )
    }
    case 'rootBefore':
    case 'rootAfter':
    case 'blobsDigest':
      return <Hash value={p[r.key]} chars={10} />
    case 'censusRoot':
      return csp ? (
        <Address value={`0x${p.censusRoot.toString(16).padStart(40, '0')}`} />
      ) : (
        <Hash value={bigIntToHex(p.censusRoot)} chars={10} />
      )
    case 'batchOk':
      return flag(p.batchOk, t`ballot proofs verified`, t`not verified`)
    case 'ecdsaOk':
      return flag(p.ecdsaOk, t`signatures verified`, t`not verified`)
    case null:
      return (
        <span className='font-mono text-[12px] text-ghost'>
          {p.registers.slice(r.index, r.index + r.span).join(', ')}
        </span>
      )
    default: {
      const v = p[r.key]
      return <span className='font-mono text-[13px] text-ghost tnum'>{formatNumber(Number(v))}</span>
    }
  }
}

/**
 * The registers the batch guest committed, each with its value, what it
 * means and who reads it, then the fail mask bit by bit and the raw words.
 */
export function PublicsPanel({ detail }: { detail: TransitionDetail }) {
  const { i18n, t } = useLingui()
  const { publics, tx } = detail
  const csp = detail.process.state?.census.origin === 'csp'
  const checkState = (id: string | undefined) => detail.checks.find((c) => c.id === id)

  return (
    <Panel
      label={t`What the proof says`}
      title={t`Public values`}
      description={t`The zkVM guest ends by committing 46 registers of 32 bits: the transition it proved and whether every check passed. A ZisK proof carries 64, the rest zero, and they travel on-chain as the 512-byte publicValues, one 8-byte little-endian word per register. The registry reads some of them and refuses the batch if any is wrong; the rest are diagnostics.`}
    >
      {publics ? (
        <div className='flex flex-col gap-5' data-testid='publics'>
          <ol className='flex flex-col'>
            <li className='label-caps hidden gap-4 border-b border-charcoal pb-2 text-[10px] text-pewter md:grid md:grid-cols-[72px_minmax(0,210px)_minmax(0,1fr)_minmax(0,1.5fr)_150px]'>
              <span>
                <Trans>Register</Trans>
              </span>
              <span>
                <Trans>Name</Trans>
              </span>
              <span>
                <Trans>Value</Trans>
              </span>
              <span>
                <Trans>Meaning</Trans>
              </span>
              <span>
                <Trans>Read by</Trans>
              </span>
            </li>
            {BATCH_REGISTERS.map((r) => {
              const check = checkState(REGISTER_CHECK[r.index])
              const note = REGISTER_NOTES[r.index]
              return (
                <li
                  key={r.index}
                  className='grid grid-cols-[64px_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-charcoal/60 py-2.5 last:border-b-0 md:grid-cols-[72px_minmax(0,210px)_minmax(0,1fr)_minmax(0,1.5fr)_150px] md:items-start'
                >
                  <span className='font-mono text-[12px] text-ash tnum'>[{span(r)}]</span>
                  <span className='inline-flex min-w-0 items-center gap-1.5'>
                    <span className='truncate font-mono text-[12px] text-silver'>{r.name}</span>
                    {check ? (
                      <Tooltip content={`${check.label}: ${check.detail}`}>
                        <span className='inline-flex'>
                          <CheckMark state={check.state} />
                        </span>
                      </Tooltip>
                    ) : null}
                  </span>
                  <span className='col-span-2 min-w-0 md:col-span-1'>
                    <RegisterValue r={r} p={publics} csp={csp} />
                  </span>
                  <span className='col-span-2 text-[12px] leading-relaxed text-ash md:col-span-1'>
                    {r.description}
                    {note ? <span className='mt-0.5 block text-pewter'>{i18n._(note)}</span> : null}
                  </span>
                  <span className='col-span-2 flex flex-wrap gap-1 md:col-span-1'>
                    {r.readBy.map((who) => (
                      <Tooltip key={who} content={i18n._(READ_BY_LABEL[who].hint)}>
                        <span className='inline-flex'>
                          <Badge size='sm' tone={who === 'diagnostic' ? 'neutral' : 'accent'}>
                            {i18n._(READ_BY_LABEL[who].label)}
                          </Badge>
                        </span>
                      </Tooltip>
                    ))}
                  </span>
                </li>
              )
            })}
          </ol>

          <FailMask mask={publics.failMask} />

          <Disclosure summary={t`All 64 registers`}>
            <p className='mb-2 text-[12px] text-ash'>
              <Trans>
                Each register as the guest wrote it, in decimal. Registers 46 to 63 are padding and always zero.
              </Trans>
            </p>
            <ol className='grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px] sm:grid-cols-4 lg:grid-cols-8'>
              {publics.registers.map((v, i) => (
                <li key={i} className='flex justify-between gap-2 tnum'>
                  <span className='text-ash'>{i}</span>
                  <span className={v ? 'text-ghost' : 'text-ash'}>{v}</span>
                </li>
              ))}
            </ol>
          </Disclosure>
          {tx?.publicValues ? (
            <Disclosure summary={t`publicValues as sent, 512 bytes`}>
              <CodeBlock code={tx.publicValues} wrap label={t`Copy publicValues`} maxHeight={240} />
            </Disclosure>
          ) : null}
        </div>
      ) : detail.publicsError ? (
        <Callout tone='danger' title={t`The public values could not be decoded`}>
          {detail.publicsError}
        </Callout>
      ) : (
        <SkeletonText lines={8} />
      )}
    </Panel>
  )
}

function FailMask({ mask }: { mask: number }) {
  const { i18n, t } = useLingui()
  const set = (bit: number) => ((mask >>> bit) & 1) === 1
  const count = FAIL_BIT_MEANINGS.filter((b) => set(b.bit)).length
  const bits = FAIL_BIT_MEANINGS.length
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2 text-[13px] text-silver'>
        <span className='label-caps text-[11px] text-pewter'>
          <Trans>Fail mask</Trans>
        </span>
        <Explain>
          <Trans>
            One bit per check family of the guest (circuit/CIRCUIT.md §11). The registry requires the whole mask to be
            zero. Checks within a phase often stop at the first failure, so a set bit is a reason, not a full list.
          </Trans>
        </Explain>
        <span className={cn('font-mono text-[12px]', count ? 'text-red' : 'text-emerald')}>
          {count ? <Plural value={count} one='# bit set' other='# bits set' /> : <Trans>every bit clear</Trans>}
        </span>
      </div>
      <Disclosure summary={t`What the guest checked: ${plural(bits, { one: '# fail bit', other: '# fail bits' })}`}>
        <ul className='flex flex-col'>
          {FAIL_BIT_MEANINGS.map((b) => (
            <li
              key={b.bit}
              className='grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-b border-charcoal/60 py-1.5 last:border-b-0 sm:grid-cols-[40px_170px_minmax(0,1fr)_70px]'
            >
              <span className='font-mono text-[12px] text-ash tnum'>{b.bit}</span>
              <span className='font-mono text-[12px] text-silver'>{b.constant}</span>
              <span className='col-span-2 text-[12px] text-ash sm:col-span-1'>{i18n._(b.meaning)}</span>
              <span className={cn('text-[12px] sm:text-right', set(b.bit) ? 'text-red' : 'text-emerald')}>
                {set(b.bit)
                  ? t({ message: 'set', comment: 'A fail bit that is 1' })
                  : t({ message: 'clear', comment: 'A fail bit that is 0' })}
              </span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  )
}
