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
        <SectionHeader size='page' label={t`Error`} title={t`Something broke while rendering this page`} />
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
