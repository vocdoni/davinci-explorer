import { useLingui } from '@lingui/react/macro'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Callout, PageContainer, SectionHeader, Stack } from '~kit'

/** Route-level error boundary. Renders outside the shell, so it stays plain. */
export function RouteError() {
  const { t } = useLingui()
  const error = useRouteError()
  // The error's own text is technical and stays as it was thrown.
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : t`Unknown error`
  const stack = error instanceof Error ? error.stack : undefined

  return (
    <PageContainer className='py-16'>
      <Stack>
        <SectionHeader
          size='page'
          label={t`Error`}
          title={t`This page could not be shown`}
          description={t`Something went wrong in the explorer while it built this page. Reloading often helps; if it keeps happening, the details below say what failed.`}
        />
        <Callout tone='danger' title={message}>
          {stack ? (
            <pre className='mt-2 max-h-64 overflow-auto rounded-sm border border-charcoal bg-obsidian p-3 text-[11px] leading-relaxed scroll-slim'>
              {stack}
            </pre>
          ) : null}
        </Callout>
      </Stack>
    </PageContainer>
  )
}
