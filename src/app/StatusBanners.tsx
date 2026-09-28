import { Trans, useLingui } from '@lingui/react/macro'
import { useRuntimeConfig } from '~config/config-context'
import { useIndexer } from '~data/hooks'
import { Button, Callout, PageContainer, ProgressBar } from '~kit'
import { formatNumber } from '~lib/format'

/**
 * Deployment-level notices above every page: the RPC is on the wrong chain
 * (indexing stops), demo mode, the first scan, and a failing RPC.
 */
export function StatusBanners() {
  const { t } = useLingui()
  const config = useRuntimeConfig()
  const { status, refresh } = useIndexer()
  const mismatch = status.chainMismatch
  const firstScan = status.scanning && status.progress < 1
  const lastError = status.errors[status.errors.length - 1]
  const failing = status.phase === 'error' && !mismatch

  if (!mismatch && !config.demo && !firstScan && !failing) return null
  const networkName = config.networkName
  const actual = mismatch?.actual
  const expected = mismatch?.expected
  const fromBlock = formatNumber(status.fromBlock)
  const lastBlock = formatNumber(status.lastBlock)
  const headBlock = formatNumber(status.headBlock)
  // The RPC's own error text is technical and stays as the RPC wrote it.
  const reason = lastError?.message ?? t`The last poll failed.`
  return (
    <PageContainer className='mt-4 flex flex-col gap-3'>
      {mismatch ? (
        <div data-testid='chain-mismatch'>
          <Callout tone='danger' title={t`Wrong network`}>
            <Trans>
              The RPC endpoint reports chain id <span className='font-mono text-ghost'>{actual}</span>, but this
              explorer is configured for <span className='font-mono text-ghost'>{expected}</span> ({networkName}).
              Nothing is indexed until <code>RPC_URL</code> and <code>CHAIN_ID</code> agree.
            </Trans>
          </Callout>
        </div>
      ) : null}
      {config.demo ? (
        <Callout tone='warn' title={t`Demo network`}>
          <Trans>
            Everything on these pages is synthetic: a deterministic network generated in your browser, with no chain
            behind it. Links to the block explorer lead nowhere. Remove <code>?demo=1</code> (or open{' '}
            <code>?demo=0</code>) to see the configured deployment.
          </Trans>
        </Callout>
      ) : null}
      {firstScan && !mismatch ? (
        <Callout tone='info' title={t`Indexing the registry`}>
          <p>
            <Trans>
              Reading every ProcessRegistry event from block {fromBlock}. Pages fill in as blocks arrive; the result is
              cached in this browser.
            </Trans>
          </p>
          <ProgressBar
            className='mt-3 max-w-md'
            value={Math.max(0, status.lastBlock - status.fromBlock)}
            total={Math.max(1, status.headBlock - status.fromBlock)}
            label={t`block ${lastBlock} of ${headBlock}`}
          />
        </Callout>
      ) : null}
      {failing ? (
        <Callout
          tone='danger'
          title={t`The RPC is not answering`}
          actions={
            <Button size='sm' onClick={() => void refresh()}>
              <Trans>Retry</Trans>
            </Button>
          }
        >
          <Trans>{reason} The explorer keeps retrying.</Trans>
        </Callout>
      ) : null}
    </PageContainer>
  )
}
