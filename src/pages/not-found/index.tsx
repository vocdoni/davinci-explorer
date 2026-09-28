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
        title={t`No such page`}
        description={t`Nothing is routed at ${pathname}.`}
      />
      <EmptyState
        title={t`Try the overview`}
        description={t`Or search for a process id, vote id, transaction, address or block in the bar above.`}
        action={
          <Link to={paths.home()} className={buttonClasses('ghost', 'sm')}>
            <Trans>Go to the overview</Trans>
          </Link>
        }
      />
    </Stack>
  )
}
