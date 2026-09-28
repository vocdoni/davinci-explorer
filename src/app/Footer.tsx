import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { useRuntimeConfig } from '~config/config-context'
import { Address, PageContainer } from '~kit'
import { paths } from '~routes/paths'

const LINK = 'text-pewter transition-colors hover:text-emerald'
const VERSION = import.meta.env.VITE_BUILD_VERSION || 'dev'

/** Deployment identity, source links and the route to the `/kit` showcase. */
export function Footer() {
  const { t } = useLingui()
  const config = useRuntimeConfig()
  return (
    <footer className='mt-16 border-t border-charcoal py-6'>
      <PageContainer className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ash'>
          <span>
            DAVINCI explorer <span className='font-mono'>{VERSION.length > 12 ? VERSION.slice(0, 7) : VERSION}</span>
          </span>
          <span aria-hidden='true'>·</span>
          <span className='inline-flex items-center gap-1'>
            <Trans>registry</Trans> <Address value={config.registryAddress} copy={false} />
          </span>
          <span aria-hidden='true'>·</span>
          <span>
            <Trans>read-only, straight from the chain</Trans>
          </span>
        </div>
        <nav aria-label={t`Footer`} className='flex flex-wrap items-center gap-4 text-[12px]'>
          <Link to={paths.learn()} className={LINK}>
            <Trans>How it works</Trans>
          </Link>
          <Link to={paths.verifyDeployment()} className={LINK}>
            <Trans>Verify the deployment</Trans>
          </Link>
          <a
            href='https://github.com/vocdoni/davinci-explorer'
            target='_blank'
            rel='noreferrer noopener'
            className={LINK}
          >
            <Trans>Source</Trans>
          </a>
          <Link to={paths.kit()} className={LINK}>
            <Trans>Design kit</Trans>
          </Link>
        </nav>
      </PageContainer>
    </footer>
  )
}
