// The metadata panel of a process: the document checked against the hash the
// organizer committed on-chain, what it says, and every version it had.

import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { CheckMark, Timestamp, TxLink, UnverifiedMark } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import { useChain, type ProcessView } from '~data/hooks'
import { useMetadataCheck, type MetadataCheck } from '~data/queries'
import type { MetadataVersion } from '~indexer/types'
import {
  Badge,
  CheckIcon,
  CloseIcon,
  Hash,
  InfoIcon,
  KeyValue,
  Panel,
  SkeletonText,
  Timeline,
  TimelineRow,
  UriLink,
  WarningIcon,
} from '~kit'
import { cn } from '~lib/cn'
import { formatBytes } from '~lib/format'
import { metadataHashCommand, metadataHistoryCommand } from '~pages/transition/commands'
import { browsableUri, sameHash, type MetadataStatus } from '~protocol/metadata'
import { toJson } from './json'
import { changedWhileOpen, metadataChoices, metadataDescription, metadataTitle } from './metadata'

const VERDICT: Record<MetadataStatus, { box: string; disc: string }> = {
  matches: { box: 'border-emerald/30 bg-emerald/[0.05]', disc: 'border-emerald/35 bg-emerald/12 text-emerald' },
  differs: { box: 'border-red/35 bg-red/[0.06]', disc: 'border-red/35 bg-red/12 text-red' },
  unreachable: { box: 'border-amber/30 bg-amber/[0.05]', disc: 'border-amber/35 bg-amber/12 text-amber' },
  'not-browsable': { box: 'border-charcoal bg-onyx/40', disc: 'border-charcoal bg-onyx text-pewter' },
  loading: { box: 'border-charcoal bg-onyx/40', disc: 'border-charcoal bg-onyx text-ash' },
}

function VerdictIcon({ status }: { status: MetadataStatus }) {
  if (status === 'matches') return <CheckIcon size={15} />
  if (status === 'differs') return <CloseIcon size={15} />
  if (status === 'unreachable') return <WarningIcon size={15} />
  return <InfoIcon size={15} />
}

/** The check, first and loud: a pass or a fail and one plain sentence. */
export function MetadataVerdict({ check, history }: { check: MetadataCheck; history: MetadataVersion[] }) {
  const { t } = useLingui()
  const { status } = check
  const detail = check.error ?? ''
  // A stale copy is worth naming: the URI serves a version the organizer replaced.
  const served = check.served
  const older = served ? history.findIndex((v, i) => i < history.length - 1 && sameHash(v.hash, served.hash)) : -1
  const version = older + 1
  let title: string
  let body: ReactNode
  switch (status) {
    case 'matches':
      title = t`The document matches the on-chain hash`
      body = (
        <Trans>
          The document at this address is, byte for byte, the one the organizer committed on-chain. Its title, question
          and option names are the organizer’s.
        </Trans>
      )
      break
    case 'differs':
      title = t`The document does not match the on-chain hash`
      body =
        older >= 0 ? (
          <Trans>
            The address serves version {version}, which the organizer has since replaced, not the document committed
            on-chain now. Do not rely on its title, question or option names.
          </Trans>
        ) : (
          <Trans>
            The address serves another document than the one the organizer committed on-chain. Do not rely on its title,
            question or option names: they may not be what voters were shown.
          </Trans>
        )
      break
    case 'unreachable':
      title = t`The document could not be checked`
      body = (
        <Trans>
          The explorer could not download it ({detail}), so its hash was not compared. The host may be offline or refuse
          requests from other sites; the command below checks it from a terminal.
        </Trans>
      )
      break
    case 'not-browsable':
      title = t`The document cannot be checked here`
      body = check.uri ? (
        <Trans>
          A browser cannot fetch this URI (only http, https and ipfs are read). Download the document yourself and
          compare its SHA-256 with the committed hash.
        </Trans>
      ) : (
        <Trans>This process has no metadata document.</Trans>
      )
      break
    default:
      title = t`Checking the document…`
      body = <Trans>Downloading it and computing its SHA-256 in your browser.</Trans>
  }
  const style = VERDICT[status]
  return (
    <div
      data-testid='metadata-check'
      data-status={status}
      role='status'
      className={cn('flex gap-3 rounded-md border p-4', style.box)}
    >
      <span
        aria-hidden='true'
        className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border', style.disc)}
      >
        <VerdictIcon status={status} />
      </span>
      <div className='min-w-0 flex-1'>
        <div className='text-[14px] font-semibold text-ghost'>{title}</div>
        <p className='mt-1 text-[13px] leading-relaxed text-silver'>{body}</p>
      </div>
    </div>
  )
}

export function MetadataPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const chain = useChain()
  const s = view.process.state!
  const check = useMetadataCheck(s.metadataURI, s.metadataHash)
  const history = view.process.metadataHistory
  const uri = s.metadataURI
  const href = uri ? browsableUri(uri) : null
  const served = check.served
  const size = served ? formatBytes(served.size) : null
  return (
    <Panel
      title={t`Metadata`}
      label={t`Published by the organizer`}
      description={t`The title, the question and the option names live in this document, not on the chain, which only knows field 1, field 2 and so on. The registry stores the document’s address and the SHA-256 of its exact bytes; the explorer downloads it and compares.`}
    >
      <div className='flex flex-col gap-4'>
        <MetadataVerdict check={check} history={history} />
        <KeyValue
          items={[
            {
              label: t`Metadata URI`,
              value: uri ? (
                <UriLink uri={uri} href={href} label={t`Open the document`} />
              ) : (
                <span className='text-ash'>
                  <Trans>none</Trans>
                </span>
              ),
            },
            {
              label: t`Committed hash`,
              value: <Hash value={s.metadataHash} chars={10} />,
              hint: t`metadataHash in getProcess: SHA-256 of the exact bytes`,
            },
            ...(served
              ? [
                  {
                    label: t`Served hash`,
                    value: (
                      <span className='inline-flex items-center gap-2'>
                        <CheckMark state={check.status === 'matches' ? 'pass' : 'fail'} />
                        <Hash value={served.hash} chars={10} />
                      </span>
                    ),
                    hint: t`SHA-256 of the bytes downloaded (${size}), computed in your browser`,
                  },
                ]
              : []),
          ]}
        />
        <MetadataContent check={check} numFields={s.ballotMode.numFields} />
        <MetadataHistory view={view} />
        {uri ? (
          <Disclosure summary={t`Check it yourself`} testId='metadata-redo'>
            <div className='flex flex-col gap-3 text-[13px] leading-relaxed text-ash'>
              <p>
                <Trans>
                  The first line hashes what the address serves; the second prints the registry’s record, whose
                  fourteenth value is the committed hash. They must be equal (sha256sum leaves out the 0x). The last
                  command lists every version the organizer set.
                </Trans>
              </p>
              <CodeBlock
                code={[
                  metadataHashCommand({ registry: chain.registryAddress, processId: view.process.id, uri }),
                  metadataHistoryCommand({
                    registry: chain.registryAddress,
                    processId: view.process.id,
                    fromBlock: view.process.createdBlock,
                  }),
                ].join('\n')}
                label={t`Copy the commands`}
              />
            </div>
          </Disclosure>
        ) : null}
      </div>
    </Panel>
  )
}

/** What the document says, parsed from the bytes that were hashed; marked when they are not the committed ones. */
function MetadataContent({ check, numFields }: { check: MetadataCheck; numFields: number }) {
  const doc = check.doc
  const title = metadataTitle(doc)
  const description = metadataDescription(doc)
  const choices = metadataChoices(doc, numFields)
  const unverified = check.status === 'differs'
  const parseError = check.served?.parseError ?? ''
  return (
    <div data-testid='process-metadata' data-verified={check.status === 'matches'}>
      {check.status === 'loading' && check.uri ? (
        <SkeletonText lines={3} />
      ) : !check.served ? null : doc === undefined ? (
        <p className='text-[13px] text-ash'>
          <Trans>The bytes served are not a JSON document ({parseError}).</Trans>
        </p>
      ) : (
        <div className='flex flex-col gap-3'>
          {title || unverified ? (
            <div className='flex flex-wrap items-center gap-2'>
              {title ? <span className='text-[15px] font-semibold text-ghost'>{title}</span> : null}
              {unverified ? <UnverifiedMark /> : null}
            </div>
          ) : null}
          {description ? <p className='text-[13px] leading-relaxed text-ash'>{description}</p> : null}
          {choices ? (
            <div className='flex flex-wrap items-center gap-2'>
              {choices.map((choice, i) => {
                const position = i + 1
                return (
                  <Badge key={i}>
                    <Trans>
                      field {position}: {choice}
                    </Trans>
                  </Badge>
                )
              })}
            </div>
          ) : null}
          <details className='rounded-sm border border-charcoal'>
            <summary className='cursor-pointer px-3 py-2 text-[13px] text-pewter hover:text-ghost'>
              <Trans>The document as JSON</Trans>
            </summary>
            <pre className='max-h-80 overflow-auto border-t border-charcoal p-3 text-[11px] leading-relaxed text-silver scroll-slim'>
              {toJson(doc)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

/** Every version the registry recorded, oldest first; a change made while voting was open is flagged in amber. */
function MetadataHistory({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const history = view.process.metadataHistory
  if (history.length === 0) return null
  return (
    <section data-testid='metadata-history' className='flex flex-col gap-2'>
      <div>
        <h3 className='label-caps text-[11px] text-pewter'>
          <Trans>History</Trans>
        </h3>
        <p className='mt-1 text-xs leading-relaxed text-ash'>
          <Trans>
            Every version the registry recorded. The organizer may replace the document while the process is Ready or
            Paused and before its end; after that it is frozen.
          </Trans>
        </p>
      </div>
      <Timeline>
        {history.map((v, i) => {
          const n = i + 1
          const current = i === history.length - 1
          const flagged = changedWhileOpen(v)
          return (
            <TimelineRow
              key={`${v.block}:${v.logIndex}`}
              last={current}
              tone={flagged ? 'warn' : current ? 'ok' : 'muted'}
              title={v.atCreation ? t`Version ${n}, set at creation` : t`Version ${n}, set by the organizer`}
              meta={<Timestamp value={v.timestamp} />}
              right={v.tx ? <TxLink hash={v.tx} chars={4} /> : null}
              description={
                <div className='mt-1 flex flex-col gap-1.5' data-testid={`metadata-version-${n}`}>
                  <div className='flex flex-wrap items-center gap-2'>
                    {current ? (
                      <Badge tone='ok' size='sm'>
                        <Trans>current</Trans>
                      </Badge>
                    ) : null}
                    {flagged ? (
                      <Badge tone='warn' size='sm'>
                        <Trans>changed while voting was open</Trans>
                      </Badge>
                    ) : null}
                    <UriLink uri={v.uri} href={browsableUri(v.uri)} label={t`Open version ${n}`} />
                  </div>
                  <Hash value={v.hash} chars={10} />
                  {flagged ? (
                    <p className='text-[12px] leading-relaxed text-amber'>
                      {v.afterFirstVote ? (
                        <Trans>
                          The organizer changed the description while voting was open, after votes had settled. Votes
                          cast before this change were cast under the previous version.
                        </Trans>
                      ) : (
                        <Trans>
                          The organizer changed the description while voting was open. Votes cast before this change
                          were cast under the previous version.
                        </Trans>
                      )}
                    </p>
                  ) : null}
                </div>
              }
            />
          )
        })}
      </Timeline>
    </section>
  )
}
