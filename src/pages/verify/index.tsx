import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { useNetworkName } from '~config/config-context'
import { Stack } from '~kit'
import { paths } from '~routes/paths'
import { ArrowRightIcon, BallotBoxIcon, BallotIcon, EyeIcon, ShieldIcon, TerminalIcon } from './icons'

function Choice({
  to,
  testId,
  icon,
  question,
  who,
  children,
  needs,
}: {
  to: string
  testId: string
  icon: ReactNode
  question: ReactNode
  who: ReactNode
  children: ReactNode
  needs: ReactNode
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className='group flex flex-col rounded-md border border-charcoal bg-carbon p-6 transition-colors hover:border-emerald/60 hover:bg-onyx/40 focus-visible:border-emerald'
    >
      <span className='flex items-center justify-between gap-3'>
        <span
          aria-hidden='true'
          className='flex h-12 w-12 items-center justify-center rounded-md border border-emerald/30 bg-emerald/10 text-emerald'
        >
          {icon}
        </span>
        <span className='label-caps text-[11px] text-pewter'>{who}</span>
      </span>
      <span className='mt-5 text-[20px] leading-snug font-semibold tracking-tight text-ghost group-hover:text-emerald'>
        {question}
      </span>
      <span className='mt-2 flex-1 text-[14px] leading-relaxed text-ash'>{children}</span>
      <span className='mt-5 flex items-center justify-between gap-3 border-t border-charcoal pt-4'>
        <span className='min-w-0 text-[12px] text-pewter'>{needs}</span>
        <span className='inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-emerald'>
          <Trans>Start</Trans>
          <ArrowRightIcon size={14} className='transition-transform group-hover:translate-x-0.5' />
        </span>
      </span>
    </Link>
  )
}

function Principle({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <div className='flex gap-3'>
      <span
        aria-hidden='true'
        className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-charcoal text-pewter'
      >
        {icon}
      </span>
      <div className='min-w-0'>
        <div className='text-[14px] font-medium text-ghost'>{title}</div>
        <p className='mt-0.5 text-[13px] leading-relaxed text-ash'>{children}</p>
      </div>
    </div>
  )
}

/** `/verify`: what to check, by who you are. */
export function VerifyPage() {
  const { t } = useLingui()
  const networkName = useNetworkName()
  return (
    <Stack data-testid='page-verify' className='gap-10'>
      <header className='max-w-3xl'>
        <div className='label-caps mb-2 text-emerald'>
          <Trans>Verify</Trans>
        </div>
        <h1 className='text-[32px] leading-tight font-semibold tracking-tight text-ghost'>
          <Trans>Check it yourself</Trans>
        </h1>
        <p className='mt-3 text-[16px] leading-relaxed text-pewter'>
          <Trans>
            Nothing here asks you to trust this site. Each check says in plain words what it proves, shows the values it
            compared, and gives you the command to redo it on your own computer.
          </Trans>
        </p>
      </header>

      <nav aria-label={t`What to check`} className='grid gap-4 lg:grid-cols-3'>
        <Choice
          to={paths.votes()}
          testId='verify-choice-vote'
          icon={<BallotIcon size={24} />}
          who={<Trans>For voters</Trans>}
          question={<Trans>Was my vote counted?</Trans>}
          needs={<Trans>You need the vote id from your voting app.</Trans>}
        >
          <Trans>
            Find the batch that carried your vote onto the chain, check that it passed every check, and see it go into
            the results.
          </Trans>
        </Choice>
        <Choice
          to={paths.verifyElection()}
          testId='verify-choice-election'
          icon={<BallotBoxIcon size={24} />}
          who={<Trans>For organizers and observers</Trans>}
          question={<Trans>Was this election run correctly?</Trans>}
          needs={<Trans>Pick the election from a list, or paste its id.</Trans>}
        >
          <Trans>
            Who could vote and who can open the ballots, every batch of votes and its checks, and how the results were
            produced.
          </Trans>
        </Choice>
        <Choice
          to={paths.verifyDeployment()}
          testId='verify-choice-deployment'
          icon={<ShieldIcon size={24} />}
          who={<Trans>For auditors</Trans>}
          question={<Trans>Is this the real DAVINCI, running the published code?</Trans>}
          needs={<Trans>Nothing to enter: it checks {networkName}.</Trans>}
        >
          <Trans>
            The programs and keys the contracts accept proofs from, the contracts and their source code, and the key
            committee.
          </Trans>
        </Choice>
      </nav>

      <section aria-labelledby='verify-how' className='grid gap-6 border-t border-charcoal pt-8 md:grid-cols-3'>
        <h2 id='verify-how' className='sr-only'>
          <Trans>How these checks work</Trans>
        </h2>
        <Principle icon={<EyeIcon size={15} />} title={<Trans>Read by your browser</Trans>}>
          <Trans>
            Your browser reads the values from public blockchain nodes and runs the checks itself. This site keeps no
            database of its own.
          </Trans>
        </Principle>
        <Principle icon={<ShieldIcon size={15} />} title={<Trans>Honest about limits</Trans>}>
          <Trans>
            Every flow ends with what its checks prove and what they don’t, such as what stays secret and what stays
            public.
          </Trans>
        </Principle>
        <Principle icon={<TerminalIcon size={15} />} title={<Trans>Repeatable without us</Trans>}>
          <Trans>
            Open “How this is checked” under any check for the command that redoes it with standard tools, against any
            node you choose.
          </Trans>
        </Principle>
      </section>
    </Stack>
  )
}
