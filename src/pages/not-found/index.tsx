import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useLocation } from 'react-router'
import { buttonClasses, EmptyState, SectionHeader, Stack } from '~kit'
import { paths } from '~routes/paths'

export function NotFoundPage() {
  const { t } = useLingui()
  const { pathname } = useLocation()
  return (
    <Stack data-testid='page-not-found'>
      <SectionHeader
        size='page'
        label='404'
        title={t`Page not found`}
        description={t`The explorer has no page at ${pathname}. The link may be mistyped, or from an older version of the explorer.`}
      />
      <EmptyState
        title={t`Start from the overview`}
        description={t`Or paste a process id, vote id, transaction, address or block number into the search bar at the top.`}
        action={
          <Link to={paths.home()} className={buttonClasses('ghost', 'sm')}>
            <Trans>Go to the overview</Trans>
          </Link>
        }
      />
    </Stack>
  )
}
