import { useMemo, useState, type ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { SortingState } from '@tanstack/react-table'
import { CheckMark, Explain, Formula, KeyModeBadge, Term, Timestamp } from '~components'
import { Disclosure } from '~components/code'
import { useRuntimeConfig } from '~config/config-context'
import { useChain, type ProcessView } from '~data/hooks'
import { useDkgApplication } from '~data/queries'
import {
  Address,
  Badge,
  BlockCell,
  Callout,
  DataTable,
  ExternalIcon,
  Hash,
  KeyValue,
  Panel,
  SkeletonText,
  TxCell,
  type AnyColumnDef,
} from '~kit'
import type { DkgCiphertextView } from '~data/services'
import { bigIntToHex, formatList, formatNumber } from '~lib/format'
import type { KeyModeName } from '~protocol/types'
import { reducedToCircom } from '~protocol/babyjubjub'
import { dkgApplicationUrl, dkgEpochUrl } from '../dkg-links'
import { useCreation, votingEnd } from '../ending'
import { revealedBeforeEnd } from '../reveal'

/** Who holds the key, how the results come out, what a reader trusts: plain first, the mechanism apart. */
function Trust({ mode }: { mode: KeyModeName }) {
  const rows: Record<KeyModeName, { who: ReactNode; when: ReactNode; risk: ReactNode; detail: ReactNode }> = {
    sequencer: {
      who: (
        <Trans>
          One sequencer node holds the secret that opens the ballots. The organizer got this key from that node when it
          created the election.
        </Trans>
      ),
      when: (
        <Trans>
          After voting ends, the key holder decrypts the <Term id='accumulator'>encrypted total</Term>, proves that the
          results are right and publishes them.
        </Trans>
      ),
      risk: (
        <Trans>
          The key holder could read every ballot in the published data, and nobody else can publish the results. This
          mode trusts one party with ballot secrecy.
        </Trans>
      ),
      detail: (
        <Trans>
          The organizer supplied the key at creation, normally one it got from a sequencer node (
          <code>POST /processes/keys</code>). That node derives the secret from its master secret and the process id and
          never stores it. After the end, the key holder decrypts the final accumulator (the encrypted sum of all
          ballots), proves the tally with the zkVM results program and publishes it with <code>setProcessResults</code>.
        </Trans>
      ),
    },
    'dkg-automatic': {
      who: (
        <Trans>
          A <Term id='committee'>key committee</Term> holds the key in shares. No sequencer and no organizer knows the
          secret, and no member knows it alone.
        </Trans>
      ),
      when: (
        <Trans>
          After voting ends, the encrypted total goes to the committee and enough members together decrypt it. They
          decrypt only that final total, never a single ballot.
        </Trans>
      ),
      risk: (
        <Trans>
          Enough members of the committee colluding (a <Term id='threshold'>threshold</Term> of them) could read every
          ballot. If so many members leave before the end that fewer than the threshold remain, the results are lost.
        </Trans>
      ),
      detail: (
        <Trans>
          The key is one pool key of a davinci-dkg committee epoch; each committee member holds one share of its secret.
          After the end, anyone can send the final accumulator to the committee (<code>requestResultsDecryption</code>);
          sequencers do it on their first heartbeat after the end. A threshold of members post partial decryptions, each
          with a Groth16 proof, and a combine yields each field’s total. The committee never reconstructs the secret.
          With n members and a threshold t, losing more than <Formula expr='n − t' /> members before the end loses the
          results.
        </Trans>
      ),
    },
    'dkg-locked': {
      who: (
        <Trans>
          A committee key plus a secret the organizer keeps (the <Term id='organizer-secret'>organizer secret</Term>).
          Neither can decrypt without the other.
        </Trans>
      ),
      when: (
        <Trans>
          The committee can decrypt the encrypted total only after the organizer reveals the organizer secret. The
          organizer decides when the results appear, not what they are.
        </Trans>
      ),
      risk: (
        <Trans>
          If the organizer loses the secret, the results are lost. Revealing it while voting is open leaves the election
          with the trust of the automatic mode.
        </Trans>
      ),
      detail: (
        <Trans>
          The key is a committee pool key plus an organizer key. The organizer received its secret at creation; the
          registry never stores it. The committee cannot post partial decryptions until the organizer reveals the secret
          (<code>revealProcessKey</code>).
        </Trans>
      ),
    },
  }
  const row = rows[mode]
  return (
    <div className='flex flex-col gap-3'>
      <dl className='flex flex-col gap-3 text-[13px] leading-relaxed'>
        <div>
          <dt className='label-caps text-[11px] text-pewter'>
            <Trans>Who holds the key</Trans>
          </dt>
          <dd className='mt-1 text-silver'>{row.who}</dd>
        </div>
        <div>
          <dt className='label-caps text-[11px] text-pewter'>
            <Trans>How the results are decrypted</Trans>
          </dt>
          <dd className='mt-1 text-silver'>{row.when}</dd>
        </div>
        <div>
          <dt className='label-caps text-[11px] text-pewter'>
            <Trans>What you trust</Trans>
          </dt>
          <dd className='mt-1 text-silver'>{row.risk}</dd>
        </div>
      </dl>
      <Disclosure summary={<Trans>Technical details</Trans>} variant='plain' testId='key-mode-details'>
        <p className='text-[13px] leading-relaxed text-ash'>{row.detail}</p>
      </Disclosure>
    </div>
  )
}

function Label({ children, help }: { children: ReactNode; help: ReactNode }) {
  return (
    <span className='inline-flex items-center gap-1'>
      {children}
      <Explain>{help}</Explain>
    </span>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noreferrer noopener'
      className='inline-flex items-center gap-1 text-[13px] text-emerald hover:underline'
    >
      {children}
      <ExternalIcon size={12} />
    </a>
  )
}

function PointValue({ x, y }: { x: bigint; y: bigint }) {
  return (
    <span className='inline-flex flex-col items-end'>
      <span className='inline-flex items-center gap-1'>
        <span className='text-ash'>x</span>
        <Hash value={bigIntToHex(x)} chars={8} />
      </span>
      <span className='inline-flex items-center gap-1'>
        <span className='text-ash'>y</span>
        <Hash value={bigIntToHex(y)} chars={8} />
      </span>
    </span>
  )
}

export function KeyTab({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const s = view.process.state
  if (!s) {
    return (
      <div data-testid='tab-key'>
        <SkeletonText lines={6} className='max-w-2xl' />
      </div>
    )
  }
  return (
    <div data-testid='tab-key' className='flex flex-col gap-6'>
      <div className='grid items-start gap-6 lg:grid-cols-2'>
        <Panel title={t`Key holder`} label={t`Who can decrypt, and when`} actions={<KeyModeBadge mode={s.keyMode} />}>
          <Trust mode={s.keyMode} />
        </Panel>
        <Panel
          title={t`Election key`}
          label={t`Fixed at creation`}
          description={t`Voters encrypt their ballots to this key before sending them. It was fixed when the election was created, so it cannot change, and every batch encrypts the stored ballots afresh under it.`}
        >
          <KeyValue
            items={[
              {
                label: (
                  <Label help={t`The key is a pair of numbers, a point on a curve; this is the first one.`}>x</Label>
                ),
                value: <Hash value={bigIntToHex(s.encryptionKey.x)} chars={10} />,
                hint: <span className='font-mono break-all'>{s.encryptionKey.x.toString()}</span>,
              },
              {
                label: <Label help={t`The second number of the key.`}>y</Label>,
                value: <Hash value={bigIntToHex(s.encryptionKey.y)} chars={10} />,
                hint: <span className='font-mono break-all'>{s.encryptionKey.y.toString()}</span>,
              },
            ]}
          />
          <Disclosure summary={<Trans>Technical details</Trans>} variant='plain' className='mt-4' testId='key-details'>
            <p className='text-[13px] leading-relaxed text-ash'>
              <Trans>
                An ElGamal public key on the BabyJubJub curve: a point (x, y) in twisted Edwards form, as circomlib
                writes it. The registry fixes it in the process’s starting state as leaf <code>0x03</code>, voters
                encrypt every ballot field to it, and every batch re-encrypts the stored ballots under it.
              </Trans>
            </p>
          </Disclosure>
        </Panel>
      </div>
      {s.keyMode !== 'sequencer' ? <DkgPanel view={view} /> : null}
    </div>
  )
}

function DkgPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const { dkgExplorerUrl } = useRuntimeConfig()
  const chain = useChain()
  const dkg = useDkgApplication(view.process.id)
  const [sorting, setSorting] = useState<SortingState>([])
  const s = view.process.state!
  const info = s.dkg
  const app = dkg.data
  const locked = s.keyMode === 'dkg-locked'
  const appUrl = info ? dkgApplicationUrl(dkgExplorerUrl, info.epochId, info.aid) : null
  const epochUrl = info ? dkgEpochUrl(dkgExplorerUrl, info.epochId) : null
  const converted = app ? reducedToCircom(app.applicationKey) : null
  const keyMatches = converted != null && converted.x === s.encryptionKey.x && converted.y === s.encryptionKey.y
  const creation = useCreation(view.process)
  const end = votingEnd(view.process, view.row, creation?.initialDuration ?? null)
  const early = locked ? revealedBeforeEnd(app?.reveal, end) : null

  // Built here, not at module scope: the headers and cells are text.
  const ciphertextColumns = useMemo<AnyColumnDef<DkgCiphertextView>[]>(
    () => [
      { id: 'index', header: t`Committee index`, accessorKey: 'index', meta: { numeric: true, width: '110px' } },
      {
        id: 'field',
        header: t`Ballot field`,
        accessorKey: 'field',
        cell: ({ row }) => {
          const position = row.original.field + 1
          return t`field ${position}`
        },
        meta: { width: '120px' },
      },
      {
        id: 'completed',
        header: t`Combined`,
        accessorFn: (r) => (r.completed ? 1 : 0),
        cell: ({ row }) => (
          <span className='inline-flex items-center gap-2'>
            <CheckMark state={row.original.completed ? 'pass' : 'unknown'} />
            {row.original.completed ? t`decrypted` : t`waiting for partial decryptions`}
          </span>
        ),
      },
      {
        id: 'plaintext',
        header: t`Decrypted value`,
        accessorFn: (r) => r.plaintext,
        cell: ({ row }) => (row.original.completed ? formatNumber(row.original.plaintext) : '—'),
        meta: { numeric: true },
      },
    ],
    [t]
  )

  return (
    <Panel
      title={t`Key committee`}
      label={t`How this election is registered`}
      description={t`The committee decrypts only for elections registered with it. The registry registered this one on the committee round that holds its key (a davinci-dkg application), and the committee answers only what the registry sends for it.`}
      actions={
        appUrl ? (
          <ExternalLink href={appUrl}>
            <Trans>Open in the DKG explorer</Trans>
          </ExternalLink>
        ) : null
      }
    >
      {!info ? (
        <Callout tone='warn'>
          <Trans>The registry’s record of this election carries no committee data.</Trans>
        </Callout>
      ) : (
        <div className='flex flex-col gap-5'>
          {early ? (
            <Callout tone='warn' title={t`The organizer secret was revealed before voting ended`}>
              <Trans>
                From then on the key was no longer locked: a threshold of committee members acting together could have
                opened single ballots, as with an automatic committee key. The results are not affected; the committee
                still decrypts only the final total.
              </Trans>
            </Callout>
          ) : null}
          <div className='grid gap-6 lg:grid-cols-2'>
            <KeyValue
              items={[
                {
                  label: (
                    <Label help={t`The committee round that created this key (a DKG epoch).`}>
                      <Trans>Epoch</Trans>
                    </Label>
                  ),
                  value: (
                    <span className='inline-flex items-center gap-2'>
                      <Hash value={info.epochId} chars={10} />
                      {epochUrl ? (
                        <ExternalLink href={epochUrl}>
                          <Trans>epoch</Trans>
                        </ExternalLink>
                      ) : null}
                    </span>
                  ),
                },
                {
                  label: (
                    <Label
                      help={
                        <Trans>
                          The number that ties this election to the key committee (its application id). Anyone can
                          recompute it from the chain id, the registry and the process id:{' '}
                          <Formula expr='aid = keccak256(abi.encode(chainId, registry, processId)) mod Q' />, with Q the
                          BabyJubJub base field. A result of zero becomes 1.
                        </Trans>
                      }
                    >
                      aid
                    </Label>
                  ),
                  value: <Hash value={info.aid} chars={10} />,
                },
                {
                  label: (
                    <Label
                      help={t`Each committee round creates 16 separate keys (pool keys). Every election takes one, so a decryption for it cannot touch another.`}
                    >
                      <Trans>Pool index</Trans>
                    </Label>
                  ),
                  value: app ? app.poolIndex : dkg.isLoading ? '…' : '—',
                  mono: true,
                },
                ...(app
                  ? [
                      {
                        label: t`Registered at block`,
                        value: <BlockCell block={app.createdAtBlock} />,
                      },
                      {
                        label: t`Registrant`,
                        value: <Address value={app.creator} />,
                        hint:
                          chain.registry?.dkgAdapter && app.creator === chain.registry.dkgAdapter.toLowerCase()
                            ? t`the registry’s key committee adapter`
                            : undefined,
                      },
                    ]
                  : []),
              ]}
            />
            {dkg.isLoading ? (
              <SkeletonText lines={5} />
            ) : dkg.error ? (
              <Callout tone='warn' title={t`Could not read the key committee’s contracts`}>
                {dkg.error instanceof Error ? dkg.error.message : String(dkg.error)}
              </Callout>
            ) : app ? (
              <KeyValue
                items={[
                  {
                    label: (
                      <Label help={<Trans>The committee’s key for this election, one of its round’s pool keys.</Trans>}>
                        <Trans>Pool key</Trans>
                      </Label>
                    ),
                    value: app.poolKey ? <PointValue x={app.poolKey.x} y={app.poolKey.y} /> : '—',
                  },
                  {
                    label: (
                      <Label
                        help={
                          <Trans>
                            The public half of the organizer secret. In the automatic mode there is no organizer key.
                          </Trans>
                        }
                      >
                        <Trans>Organizer key</Trans>
                      </Label>
                    ),
                    value: locked ? (
                      <PointValue x={app.organizerPK.x} y={app.organizerPK.y} />
                    ) : (
                      <span className='text-ash'>
                        <Trans>none (automatic)</Trans>
                      </span>
                    ),
                  },
                  {
                    label: (
                      <Label
                        help={
                          <Trans>
                            The key the ballots are encrypted to: the pool key combined with the organizer key when
                            locked, the pool key alone otherwise. Converted to the registry’s form, it must be the
                            election key.
                          </Trans>
                        }
                      >
                        <Trans>Application key</Trans>
                      </Label>
                    ),
                    value: (
                      <span className='inline-flex items-center gap-2'>
                        <PointValue x={app.applicationKey.x} y={app.applicationKey.y} />
                        <CheckMark state={keyMatches ? 'pass' : 'fail'} />
                      </span>
                    ),
                    hint: keyMatches
                      ? t`once converted, it is the election key`
                      : t`once converted, it is not the election key`,
                  },
                  {
                    label: (
                      <Label
                        help={
                          <Trans>
                            In the locked mode the committee cannot decrypt until the organizer reveals this secret. The
                            committee’s contracts check that it is the right one.
                          </Trans>
                        }
                      >
                        <Trans>Organizer secret</Trans>
                      </Label>
                    ),
                    value: !locked ? (
                      <Badge>
                        <Trans>not needed</Trans>
                      </Badge>
                    ) : app.revealed ? (
                      <span className='inline-flex flex-wrap items-center justify-end gap-2'>
                        <Badge tone={early ? 'warn' : 'ok'}>
                          <Trans>revealed</Trans>
                        </Badge>
                        <Hash value={bigIntToHex(app.organizerSecret)} chars={6} />
                        {/* The registry emits no event for a reveal, so the explorer has no page for it. */}
                        {app.reveal?.tx ? <TxCell hash={app.reveal.tx} chars={4} copy /> : null}
                      </span>
                    ) : (
                      <Badge tone='warn'>
                        <Trans>sealed</Trans>
                      </Badge>
                    ),
                    hint:
                      locked && app.reveal?.timestamp != null ? (
                        <span className={early ? 'text-amber' : undefined} data-testid='reveal-time'>
                          {early ? (
                            <Trans>
                              revealed <Timestamp value={app.reveal.timestamp} />, before voting ended
                            </Trans>
                          ) : (
                            <Trans>
                              revealed <Timestamp value={app.reveal.timestamp} />, after voting ended
                            </Trans>
                          )}
                        </span>
                      ) : undefined,
                  },
                ]}
              />
            ) : (
              <p className='text-[13px] text-ash'>
                <Trans>The committee has no registration for this election.</Trans>
              </p>
            )}
          </div>

          <Disclosure summary={<Trans>Technical details</Trans>} variant='plain' testId='dkg-key-details'>
            <p className='text-[13px] leading-relaxed text-ash'>
              <Trans>
                The registration is a davinci-dkg application. The pool key <Formula expr='P_j' />, the organizer key{' '}
                <Formula expr='PK_org' /> and the application key are points in the DKG’s reduced twisted Edwards form.
                The application key is <Formula expr='P_j + PK_org' /> when locked and <Formula expr='P_j' /> otherwise;
                in the automatic mode <Formula expr='PK_org' /> is the identity point (0, 1). The registry stores the
                election key in circomlib form (same y, x scaled by a fixed constant), and the check above redoes that
                conversion. When the organizer reveals its secret, the DKG checks <Formula expr='sk · G = PK_org' />. An
                empty ballot field is the identity point, sent nowhere and recorded as 0.
              </Trans>
            </p>
          </Disclosure>

          <div>
            <div className='label-caps mb-2 inline-flex items-center gap-1 text-[11px] text-pewter'>
              <Trans>Sent to the committee</Trans>
              <Explain>
                <Trans>
                  The encrypted total goes to the committee as one encrypted value per ballot field. Every vote and
                  refresh adds to every field, so even an option nobody picked holds a real encrypted value. Only an
                  election that never counted a ballot has empty fields, which are recorded as 0 without the committee.
                  The call is <code>requestResultsDecryption</code>.
                </Trans>
              </Explain>
            </div>
            {!info.resultsRequested ? (
              <p className='text-[13px] text-ash'>
                <Trans>
                  Nothing yet. After voting ends, anyone can send the encrypted total to the committee (sequencers do it
                  on their first heartbeat after the end). Its values then appear here with how far their decryption
                  got.
                </Trans>
              </p>
            ) : app ? (
              <>
                <p className='mb-2 text-[13px] text-ash'>
                  <SubmittedSummary count={info.count} firstIndex={info.firstIndex} zeroSkipped={info.zeroSkipped} />
                  {locked && !app.revealed ? (
                    <>
                      {' '}
                      <Trans>The committee waits for the organizer’s reveal before it can decrypt them.</Trans>
                    </>
                  ) : null}
                </p>
                {info.count === 0 ? null : (
                  <div className='overflow-hidden rounded-sm border border-charcoal'>
                    <DataTable
                      data={app.ciphertexts}
                      columns={ciphertextColumns}
                      getRowId={(r) => String(r.index)}
                      sorting={sorting}
                      onSortingChange={setSorting}
                      empty={
                        <p className='p-4 text-[13px] text-ash'>
                          <Trans>Every field was empty, as no ballot was counted: nothing was sent.</Trans>
                        </p>
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              <SkeletonText lines={3} />
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

/** The 1-based ballot fields set in a zero-skipped mask. */
function skippedFields(mask: number | null): number[] {
  const out: number[] = []
  if (!mask) return out
  for (let i = 0; i < 16; i++) if ((mask >> i) & 1) out.push(i + 1)
  return out
}

/** "n ciphertexts from index i", and which fields were skipped as the identity. */
function SubmittedSummary({
  count,
  firstIndex,
  zeroSkipped,
}: {
  count: number
  firstIndex: number
  zeroSkipped: number | null
}) {
  const { t } = useLingui()
  const first = formatNumber(firstIndex)
  const skipped = skippedFields(zeroSkipped)
  if (skipped.length === 0)
    return (
      <>{t`${plural(count, { one: '# encrypted value', other: '# encrypted values' })}, from committee index ${first}.`}</>
    )
  const identity = skipped.length
  const fields = formatList(skipped.map((f) => formatNumber(f)))
  if (count === 0)
    return (
      <>
        {t`Nothing was sent: ${plural(identity, {
          one: `field ${fields} was empty, as no ballot was counted, and was recorded as 0`,
          other: `fields ${fields} were empty, as no ballot was counted, and were recorded as 0`,
        })}.`}
      </>
    )
  return (
    <>
      {t`${plural(count, { one: '# encrypted value', other: '# encrypted values' })}, from committee index ${first}; ${plural(
        identity,
        {
          one: `field ${fields} was empty, as no ballot was counted, and was recorded as 0`,
          other: `fields ${fields} were empty, as no ballot was counted, and were recorded as 0`,
        }
      )}.`}
    </>
  )
}
