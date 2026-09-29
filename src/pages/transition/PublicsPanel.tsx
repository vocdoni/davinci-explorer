import type { ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { CheckMark, Explain, Formula, Term } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import type { TransitionDetail } from '~indexer/selectors'
import { Address, Badge, Callout, Hash, Panel, SkeletonText, Tooltip } from '~kit'
import { bigIntToHex, formatNumber } from '~lib/format'
import { cn } from '~lib/cn'
import { BATCH_FAIL_BITS, BATCH_REGISTERS, failBits, type BatchPublics, type RegisterInfo } from '~protocol/publics'
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
 * What the batch's proof makes public: each register the batch guest
 * committed with its value, what it means (and its formula) and who reads
 * it, then the fail mask bit by bit and the raw words.
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
      description={
        <Trans>
          What the proof makes public about this batch (its <Term id='public-values'>public values</Term>): the state it
          started from and ended at, how many votes it carried, which list of voters it used and whether every check
          passed. The registry reads most of them and refuses the batch if one is wrong; the rest help diagnose a
          failure.
        </Trans>
      }
    >
      {publics ? (
        <div className='flex flex-col gap-5' data-testid='publics'>
          <Disclosure summary={t`Technical details`} variant='plain'>
            <p className='text-[12px] leading-relaxed text-ash'>
              <Trans>
                The proven program (the zkVM guest) ends by committing 46 registers of 32 bits. A ZisK proof carries 64,
                the rest zero, and they travel on the chain as the 512-byte <code>publicValues</code>, one 8-byte
                little-endian word per register. Register names are the ones in davinci-zkvm{' '}
                <code>circuit/CIRCUIT.md</code> §3.
              </Trans>
            </p>
          </Disclosure>
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
                      <Tooltip
                        content={
                          <span className='flex flex-col gap-1'>
                            <span className='font-medium text-ghost'>{check.label}</span>
                            <span>{check.detail}</span>
                            {check.formula ? <Formula expr={check.formula} className='bg-carbon' /> : null}
                          </span>
                        }
                      >
                        <span className='inline-flex'>
                          <CheckMark state={check.state} />
                        </span>
                      </Tooltip>
                    ) : null}
                  </span>
                  <span className='col-span-2 min-w-0 md:col-span-1'>
                    <RegisterValue r={r} p={publics} csp={csp} />
                  </span>
                  <span className='col-span-2 flex flex-col gap-1 text-[12px] leading-relaxed text-ash md:col-span-1'>
                    <span className='text-silver'>{r.description}</span>
                    {r.formula ? <Formula expr={r.formula} className='w-fit' /> : null}
                    {note ? <span className='text-pewter'>{i18n._(note)}</span> : null}
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
                Each register as the proven program wrote it, in decimal. Registers 46 to 63 are padding and always
                zero.
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
            <Disclosure summary={t`The public values as sent (publicValues, 512 bytes)`}>
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
  const groups = FAIL_BIT_MEANINGS.length
  const plain = new Map(BATCH_FAIL_BITS.map((b) => [b.bit, b]))
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2 text-[13px] text-silver'>
        <span className='label-caps text-[11px] text-pewter'>
          <Trans>Fail mask</Trans>
        </span>
        <Explain>
          <Trans>
            Which checks failed: one bit per group of checks in the proven program (davinci-zkvm circuit/CIRCUIT.md
            §11). The registry requires every bit to be zero. The checks of a group often stop at the first failure, so
            a set bit gives a reason, not a full list.
          </Trans>
        </Explain>
        <span className={cn('font-mono text-[12px]', count ? 'text-red' : 'text-emerald')}>
          {count ? <Plural value={count} one='# bit set' other='# bits set' /> : <Trans>every bit clear</Trans>}
        </span>
      </div>
      <Disclosure
        summary={t`What each bit means: ${plural(groups, { one: '# group of checks', other: '# groups of checks' })}`}
      >
        <ul className='flex flex-col'>
          {FAIL_BIT_MEANINGS.map((b) => {
            const bit = plain.get(b.bit)
            return (
              <li
                key={b.bit}
                className='grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-b border-charcoal/60 py-2 last:border-b-0 sm:grid-cols-[40px_170px_minmax(0,1fr)_70px]'
              >
                <span className='font-mono text-[12px] text-ash tnum'>{b.bit}</span>
                <span className='font-mono text-[12px] text-silver'>{b.constant}</span>
                <span className='col-span-2 flex flex-col gap-0.5 text-[12px] leading-relaxed sm:col-span-1'>
                  {bit ? <span className='text-silver'>{bit.description}</span> : null}
                  <span className='text-ash'>{i18n._(b.meaning)}</span>
                  {bit?.formula ? <Formula expr={bit.formula} className='w-fit' /> : null}
                </span>
                <span className={cn('text-[12px] sm:text-right', set(b.bit) ? 'text-red' : 'text-emerald')}>
                  {set(b.bit)
                    ? t({ message: 'set', comment: 'A fail bit that is 1' })
                    : t({ message: 'clear', comment: 'A fail bit that is 0' })}
                </span>
              </li>
            )
          })}
        </ul>
      </Disclosure>
    </div>
  )
}
