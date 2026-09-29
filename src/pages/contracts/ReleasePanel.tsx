import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark } from '~components'
import { Formula } from '~components/Formula'
import { Badge, Callout, Hash, Panel } from '~kit'
import { formatDate } from '~lib/format'
import { KNOWN_RELEASES, PIN_LABELS, type ReleaseMatch } from '~protocol/releases'
import { paths } from '~routes/paths'
import { PIN_DETAILS, releaseVerdict } from './model'
import { Code, Ident, TechnicalToggle } from './parts'

export function ReleasePanel({
  match,
  technical = false,
  onTechnical,
}: {
  match: ReleaseMatch
  /** Show how each pin is read. */
  technical?: boolean
  onTechnical?: (on: boolean) => void
}) {
  const { i18n, t } = useLingui()
  const verdict = releaseVerdict(match)
  const r = match.closest
  const release = r?.label
  const frozen = r ? formatDate(r.date) : null
  const commit = r?.commit
  const zisk = r?.zisk
  const known = KNOWN_RELEASES.length
  return (
    <Panel
      title={t`Release check`}
      label={t`Pins against known releases`}
      description={t`The registry’s pins compared with the davinci-zkvm releases this explorer knows, the values their Rust SDK pins: the two programs, the proving setup, the verifier contract’s code and the ballot proof key.`}
      actions={onTechnical ? <TechnicalToggle checked={technical} onChange={onTechnical} /> : undefined}
    >
      <div className='flex flex-wrap items-center gap-3' data-testid='release-verdict'>
        <Badge tone={verdict.tone === 'ok' ? 'ok' : verdict.tone === 'danger' ? 'danger' : 'neutral'} dot>
          {match.release ? t`Matches a release` : verdict.tone === 'danger' ? t`Differs` : t`Checking`}
        </Badge>
        <span className='text-[13px] text-silver'>{i18n._(verdict.text)}</span>
      </div>
      {r ? (
        <p className='mt-2 text-[12px] text-ash'>
          <Trans>
            {release}: pins frozen on {frozen} at commit <Code>{commit}</Code>, proofs wrapped with ZisK {zisk}.
          </Trans>{' '}
          {known > 1 ? <Plural value={known} one='# release known.' other='# releases known.' /> : null}
        </p>
      ) : null}

      <ul className='mt-4 flex flex-col divide-y divide-charcoal rounded-md border border-charcoal'>
        {match.checks.map((c) => {
          const state = c.ok == null ? 'unknown' : c.ok ? 'pass' : 'fail'
          return (
            <li key={c.pin} data-testid={`pin-${c.pin}`} data-state={state} className='flex gap-3 p-3.5'>
              <CheckMark state={state} className='mt-0.5' />
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                  <span className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
                    <span className='text-[13px] font-medium text-ghost'>{PIN_LABELS[c.pin]}</span>
                    <Ident>{c.pin}</Ident>
                  </span>
                  <span className='text-[12px] text-ash'>
                    {state === 'pass' ? t`matches` : state === 'fail' ? t`differs` : t`not read yet`}
                  </span>
                </div>
                <p className='mt-1 text-[12px] text-pewter'>{i18n._(PIN_DETAILS[c.pin].what)}</p>
                <dl className='mt-1.5 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-[auto_minmax(0,1fr)]'>
                  <dt className='text-ash'>
                    <Trans>On the chain</Trans>
                  </dt>
                  <dd className='min-w-0'>{c.actual ? <Hash value={c.actual} chars={10} /> : '…'}</dd>
                  <dt className='text-ash'>
                    <Trans>Release</Trans>
                  </dt>
                  <dd className='min-w-0'>
                    <Hash value={c.expected} chars={10} />
                  </dd>
                  {technical ? (
                    <>
                      <dt className='text-ash'>
                        <Trans>Read with</Trans>
                      </dt>
                      <dd className='min-w-0'>
                        <Formula expr={PIN_DETAILS[c.pin].source} />
                      </dd>
                    </>
                  ) : null}
                </dl>
                <p className={state === 'fail' ? 'mt-2 text-[12px] text-red' : 'mt-2 text-[12px] text-ash'}>
                  <span className={state === 'fail' ? 'font-medium' : 'text-pewter'}>
                    {state === 'fail' ? t`It differs.` : t`What a mismatch would mean.`}
                  </span>{' '}
                  {i18n._(PIN_DETAILS[c.pin].mismatch)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      <Callout className='mt-4' title={t`What a difference means`}>
        <Trans>
          The explorer only knows the releases it was built with, so a difference can also mean a newer release it has
          not heard of. Either way, the registry checks proofs against something other than those releases. A sequencer
          built on them refuses to start against it: when it starts it compares the same values, names each one that
          differs, and cannot be told to go on anyway. Compare the pins with the davinci-zkvm release notes, or{' '}
          <Link to={paths.verifyDeployment()} className='text-silver hover:text-emerald'>
            rebuild them from source
          </Link>
          .
        </Trans>
      </Callout>
    </Panel>
  )
}
