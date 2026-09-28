import { useState, type FormEvent, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useNavigate } from 'react-router'
import { Button, buttonClasses, Card, Input } from '~kit'
import { paths } from '~routes/paths'

function RoleCard({ label, title, children }: { label: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <Card className='flex h-full flex-col gap-3'>
      <div>
        <div className='label-caps mb-1.5 text-emerald'>{label}</div>
        <h2 className='text-[15px] font-semibold text-ghost'>{title}</h2>
      </div>
      {children}
    </Card>
  )
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Where to start, by who you are. */
export function RoleCards() {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [organizer, setOrganizer] = useState('')
  const trimmed = organizer.trim()
  const invalid = trimmed !== '' && !ADDRESS.test(trimmed)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || invalid) return
    navigate(paths.processes({ organizer: trimmed.toLowerCase() }))
  }

  return (
    <div className='grid gap-4 md:grid-cols-3' data-testid='role-cards'>
      <RoleCard label={<Trans>I'm a voter</Trans>} title={<Trans>Check my vote</Trans>}>
        <p className='flex-1 text-[13px] leading-relaxed text-ash'>
          <Trans>
            Your voting app gives you a process id and a vote id. With them the explorer finds the batch whose blob
            lists your vote id and, when a sequencer is configured, checks your tracker proof against a state root the
            registry holds.
          </Trans>
        </p>
        <div>
          <Link to={paths.votes()} className={buttonClasses('primary', 'md')}>
            <Trans>Check my vote</Trans>
          </Link>
        </div>
      </RoleCard>

      <RoleCard label={<Trans>I'm an organizer</Trans>} title={<Trans>My processes</Trans>}>
        <p className='text-[13px] leading-relaxed text-ash'>
          <Trans>
            Follow your processes: ballot rules, census, key, every batch settled and the results. A process id starts
            with its organizer's address.
          </Trans>
        </p>
        <form onSubmit={submit} className='flex flex-1 flex-col justify-end gap-2' role='search'>
          <Input
            aria-label={t`Organizer address`}
            placeholder={t`Organizer address, 0x…`}
            mono
            size='sm'
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
            error={invalid ? t`An address is 0x followed by 40 hex digits.` : undefined}
          />
          <div className='flex flex-wrap gap-2'>
            <Button type='submit' variant='ghost' disabled={!trimmed || invalid}>
              <Trans>Show my processes</Trans>
            </Button>
            <Link to={paths.processes()} className={buttonClasses('subtle', 'md')}>
              <Trans>All processes</Trans>
            </Link>
          </div>
        </form>
      </RoleCard>

      <RoleCard label={<Trans>I'm an auditor</Trans>} title={<Trans>Verify the deployment</Trans>}>
        <p className='flex-1 text-[13px] leading-relaxed text-ash'>
          <Trans>
            Check which programs the registry accepts proofs from, then every state transition (root continuity, census,
            blobs) and how each result was proven. Each check comes with how to redo it yourself.
          </Trans>
        </p>
        <div className='flex flex-wrap gap-2'>
          <Link to={paths.contracts()} className={buttonClasses('ghost', 'md')}>
            <Trans>Contracts and pins</Trans>
          </Link>
          <Link to={paths.learn()} className={buttonClasses('subtle', 'md')}>
            <Trans>How DAVINCI works</Trans>
          </Link>
        </div>
      </RoleCard>
    </div>
  )
}
