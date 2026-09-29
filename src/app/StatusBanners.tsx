import { Trans, useLingui } from '@lingui/react/macro'
import { useRuntimeConfig } from '~config/config-context'
import { useIndexer } from '~data/hooks'
import { Button, Callout, PageContainer, ProgressBar } from '~kit'
import { formatNumber } from '~lib/format'

/**
 * Deployment-level notices above every page: the RPC is on the wrong chain
 * (reading stops), demo mode, the first scan, and a failing RPC.
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
  const reason = lastError?.message ?? t`no answer`
  return (
    <PageContainer className='mt-4 flex flex-col gap-3'>
      {mismatch ? (
        <div data-testid='chain-mismatch'>
          <Callout tone='danger' title={t`Wrong network`}>
            <Trans>
              The explorer is connected to another network, so it shows nothing. Its RPC endpoint is on chain id{' '}
              <span className='font-mono text-ghost'>{actual}</span>, but the explorer is set up for{' '}
              <span className='font-mono text-ghost'>{expected}</span> ({networkName}). Nothing is read until{' '}
              <code>RPC_URL</code> and <code>CHAIN_ID</code> point at the same chain.
            </Trans>
          </Callout>
        </div>
      ) : null}
      {config.demo ? (
        <Callout tone='warn' title={t`Demo network`}>
          <Trans>
            You are looking at a made-up network, generated in your browser to show how the explorer works. There is no
            chain behind it, so links to the block explorer lead nowhere. Remove{' '}
            <code className='whitespace-nowrap'>?demo=1</code> (or open{' '}
            <code className='whitespace-nowrap'>?demo=0</code>) to see the real deployment this explorer is set up for.
          </Trans>
        </Callout>
      ) : null}
      {firstScan && !mismatch ? (
        <Callout tone='info' title={t`Reading the registry`}>
          <p>
            <Trans>
              The explorer is reading the voting contract’s history (every ProcessRegistry event since block {fromBlock}
              ). Pages fill in as it goes, and your browser keeps what it read for your next visit.
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
          title={t`The chain is not answering`}
          actions={
            <Button size='sm' onClick={() => void refresh()}>
              <Trans>Retry</Trans>
            </Button>
          }
        >
          <Trans>
            The explorer could not read from its RPC endpoint and keeps trying. The last error:{' '}
            <span className='font-mono break-all'>{reason}</span>
          </Trans>
        </Callout>
      ) : null}
    </PageContainer>
  )
}
