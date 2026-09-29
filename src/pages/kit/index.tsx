import { useMemo, useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  CensusOriginBadge,
  CheckMark,
  Explain,
  Formula,
  InShort,
  KeyModeBadge,
  NativeAmount,
  NumberedList,
  ProcessPhaseBadge,
  Term,
} from '~components'
import {
  Address,
  Badge,
  BlockCell,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  Dialog,
  EmptyState,
  Hash,
  Input,
  KeyValue,
  Pagination,
  Panel,
  ProgressBar,
  SectionHeader,
  Select,
  Skeleton,
  Stack,
  Stat,
  StatCell,
  StatRow,
  Tabs,
  Timeline,
  TimelineRow,
  Toggle,
  TxCell,
  UriLink,
  type AnyColumnDef,
} from '~kit'
import { Donut, Sparkline, StackedBars } from '~kit/charts'
import type { ProcessPhase } from '~indexer/selectors'
import { formatNumber } from '~lib/format'
import type { CensusOriginName, KeyModeName } from '~protocol/types'
import { useTheme } from '~theme/theme-context'

const SAMPLE_ADDRESS = '0x3cde68c39e26ecf94bd029b6ed3b9f945441daf3'
const SAMPLE_PID = '0x42fc20654efd78c6887ff0bd1cc50c9ec1dab58980c5bb9300000000000004'
const SAMPLE_TX = `0x${'9f'.repeat(32)}`
const SAMPLE_ROOT = `0x${'0bc9dc8e'.repeat(8)}`
const SAMPLE_URI = 'https://metadata.example.org/processes/0x42fc20654efd78c6887ff0bd1cc50c9ec1dab589/metadata.json'
const SAMPLE_FILE_URI = 'file:///var/lib/davinci/census/0x42fc20654efd78c6887ff0bd1cc50c9ec1dab589/census.json'
const PHASES: ProcessPhase[] = ['upcoming', 'open', 'paused', 'closing', 'ended', 'canceled', 'results', 'loading']
const KEY_MODES: KeyModeName[] = ['sequencer', 'dkg-automatic', 'dkg-locked']
const CENSUS_ORIGINS: CensusOriginName[] = ['merkle-static', 'merkle-dynamic', 'onchain-dynamic', 'csp']

function BadgeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
      <span className='label-caps w-36 shrink-0 text-[11px] text-pewter'>{label}</span>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>{children}</div>
    </div>
  )
}

interface Row {
  index: number
  block: number
  votes: number
  blobs: number
}

/**
 * Every primitive and chart on one page, in the active theme. The design
 * review surface: switch the theme in the top bar and check both.
 */
export function KitPage() {
  const { t } = useLingui()
  const { resolved } = useTheme()
  const index = 0
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toggle, setToggle] = useState(true)
  const [page, setPage] = useState(1)
  const rows = useMemo<Row[]>(
    () =>
      Array.from({ length: 300 }, (_, i) => ({
        index: i,
        block: 48_476_748 + i * 37,
        votes: (i * 7) % 41,
        blobs: 1 + (i % 3),
      })),
    []
  )
  const columns = useMemo<AnyColumnDef<Row>[]>(
    () => [
      { id: 'index', header: '#', accessorKey: 'index', meta: { numeric: true, width: '70px' } },
      {
        id: 'block',
        header: t`Block`,
        accessorKey: 'block',
        cell: ({ row }) => <BlockCell block={row.original.block} />,
      },
      { id: 'votes', header: t`Votes`, accessorKey: 'votes', meta: { numeric: true } },
      { id: 'blobs', header: t`Data blobs`, accessorKey: 'blobs', meta: { numeric: true } },
    ],
    [t]
  )
  const activity = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        label: String(i + 1),
        values: { votes: (i * 13) % 50, overwrites: (i * 5) % 9 },
      })),
    []
  )

  return (
    <Stack data-testid='page-kit'>
      <SectionHeader
        size='page'
        label={t`Design kit`}
        title={t`Primitives and charts`}
        description={
          resolved === 'dark'
            ? t`Everything the pages are built from, in the dark theme.`
            : t`Everything the pages are built from, in the light theme.`
        }
      />

      <Panel title={t`Buttons and badges`}>
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='primary'>
            <Trans>Primary</Trans>
          </Button>
          <Button variant='ghost'>
            <Trans>Ghost</Trans>
          </Button>
          <Button>
            <Trans>Secondary</Trans>
          </Button>
          <Button variant='subtle'>
            <Trans>Subtle</Trans>
          </Button>
          <Button variant='danger'>
            <Trans>Danger</Trans>
          </Button>
          <Button loading>
            <Trans>Loading</Trans>
          </Button>
        </div>
        <div className='mt-5 flex flex-col gap-3' data-testid='kit-badges'>
          <BadgeRow label={t`Tones`}>
            <Badge tone='ok' dot>
              <Trans>ok</Trans>
            </Badge>
            <Badge tone='accent'>
              <Trans>accent</Trans>
            </Badge>
            <Badge tone='done'>
              <Trans>done</Trans>
            </Badge>
            <Badge tone='info'>
              <Trans>info</Trans>
            </Badge>
            <Badge tone='warn'>
              <Trans>warning</Trans>
            </Badge>
            <Badge tone='danger'>
              <Trans>danger</Trans>
            </Badge>
            <Badge>
              <Trans>neutral</Trans>
            </Badge>
            <Badge tone='slate'>
              <Trans>slate</Trans>
            </Badge>
            <Badge tone='violet'>
              <Trans>violet</Trans>
            </Badge>
          </BadgeRow>
          <BadgeRow label={t`Phases`}>
            {PHASES.map((phase) => (
              <ProcessPhaseBadge key={phase} phase={phase} />
            ))}
          </BadgeRow>
          <BadgeRow label={t`Key holders`}>
            {KEY_MODES.map((mode) => (
              <KeyModeBadge key={mode} mode={mode} />
            ))}
          </BadgeRow>
          <BadgeRow label={t`Lists of voters`}>
            {CENSUS_ORIGINS.map((origin) => (
              <CensusOriginBadge key={origin} origin={origin} />
            ))}
          </BadgeRow>
          <BadgeRow label={t`Checks`}>
            <CheckMark state='pass' />
            <CheckMark state='fail' />
            <CheckMark state='unknown' />
            <Explain>
              <Trans>Every value can carry a plain-words explanation.</Trans>
            </Explain>
          </BadgeRow>
        </div>
      </Panel>

      <Panel
        title={t`Long values`}
        description={t`Hover a shortened value: the tooltip grows to the whole value, and wraps only past the screen’s edge.`}
      >
        <div className='flex flex-col gap-3 text-[13px]'>
          <BadgeRow label={t`Hash`}>
            <Hash value={SAMPLE_ROOT} chars={8} />
          </BadgeRow>
          <BadgeRow label={t`Address`}>
            <Address value={SAMPLE_ADDRESS} chars={6} />
          </BadgeRow>
          <BadgeRow label={t`Transaction`}>
            <TxCell hash={SAMPLE_TX} copy />
          </BadgeRow>
          <BadgeRow label={t`Link to a document`}>
            <UriLink uri={SAMPLE_URI} href={SAMPLE_URI} label={t`Open the document`} />
          </BadgeRow>
          <BadgeRow label={t`Not a web link`}>
            <UriLink uri={SAMPLE_FILE_URI} href={null} label={t`Open the list`} />
          </BadgeRow>
        </div>
      </Panel>

      <StatRow>
        <StatCell label={t`Processes`} value={formatNumber(12)} mono hint={t`3 open`} />
        <StatCell label={t`Votes`} value={formatNumber(4210)} mono tone='accent' />
        <StatCell label={t`Data blobs`} value={formatNumber(96)} mono />
        <StatCell label={t`Loading`} value='' loading />
      </StatRow>

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card flush>
          <CardHeader label={t`Record`} title='KeyValue' description={t`The raw-record view on every detail page.`} />
          <CardBody>
            <KeyValue
              items={[
                { label: t`Registry`, value: <Address value={SAMPLE_ADDRESS} /> },
                { label: t`Process`, value: <Hash value={SAMPLE_PID} /> },
                { label: t`Transaction`, value: <TxCell hash={SAMPLE_TX} copy /> },
                { label: t`Fee`, value: <NativeAmount wei={1_234_567_000_000_000n} /> },
                { label: t`Voters`, value: formatNumber(1024), mono: true, hint: t`distinct slots written` },
              ]}
            />
          </CardBody>
        </Card>
        <Stack>
          <Callout tone='info' title={t`Info`}>
            <Trans>A neutral note with an explanation.</Trans>
          </Callout>
          <Callout tone='ok' title={t`Verified`}>
            <Trans>Every pin matches a known release.</Trans>
          </Callout>
          <Callout tone='warn' title={t`Warning`}>
            <Trans>The beacon pruned this blob; trying the sequencer.</Trans>
          </Callout>
          <Callout tone='danger' title={t`Mismatch`}>
            <Trans>The RPC reports another chain.</Trans>
          </Callout>
        </Stack>
      </div>

      <Panel
        title={t`Reading aids`}
        description={t`The pieces docs/writing.md asks for: a plain lead, glossary terms, formulas and numbered steps.`}
      >
        <div className='grid gap-6 lg:grid-cols-2'>
          <Stack>
            <InShort>
              <Trans>
                Every vote in this batch was checked and recorded. Your <Term id='vote-id'>vote id</Term> is in its
                published data, so you can find it yourself.
              </Trans>
            </InShort>
            <p className='text-[13px] leading-relaxed text-pewter'>
              <Trans>
                A blob is bound to the transaction by its <Term id='versioned-hash'>versioned hash</Term>,{' '}
                <Formula expr='0x01 ‖ sha256(commitment)[1..]' />, and a vote id is at least <Formula expr='2^63' />.
              </Trans>
            </p>
            <Formula block expr='publicInput = sha256(programVK ‖ publicValues ‖ rootCVadcopFinal) mod r_BN254' />
          </Stack>
          <NumberedList
            items={[
              <Trans key='1'>The registry checks the proof.</Trans>,
              <Trans key='2'>It checks the batch starts where the previous one ended.</Trans>,
              <Trans key='3'>It stores the new fingerprint of the election’s state.</Trans>,
            ]}
          />
        </div>
      </Panel>

      <Panel title={t`Charts`} description={t`Colours follow the theme through CSS variables.`}>
        <StackedBars
          data={activity}
          series={[
            { key: 'votes', label: t`votes` },
            { key: 'overwrites', label: t`changed votes` },
          ]}
          height={180}
        />
        <div className='mt-6 grid gap-6 sm:grid-cols-2'>
          <Donut
            slices={[
              { label: t({ message: 'open', context: 'process phase' }), value: 3 },
              { label: t({ message: 'results', context: 'process phase' }), value: 5 },
              { label: t({ message: 'ended', context: 'process phase' }), value: 2 },
            ]}
            centerValue={formatNumber(10)}
            centerLabel={t`processes`}
          />
          <div className='flex items-center'>
            <Sparkline values={[3, 8, 5, 12, 9, 15, 11, 18]} area />
          </div>
        </div>
      </Panel>

      <Card flush>
        <CardHeader title='DataTable' description={t`300 rows, virtualised.`} />
        <DataTable data={rows} columns={columns} virtualized maxHeight={280} />
        <div className='border-t border-charcoal px-5 py-3'>
          <Pagination page={page} pageCount={12} onPageChange={setPage} pageSize={25} total={300} />
        </div>
      </Card>

      <Panel title={t`Inputs, progress, timeline, tabs`}>
        <div className='grid gap-4 md:grid-cols-3'>
          <Input label={t`Process id`} mono placeholder='0x…' />
          <Select
            label={t`Status`}
            options={[
              { value: 'all', label: t`All` },
              { value: 'open', label: t`Open` },
            ]}
          />
          <Toggle checked={toggle} onChange={setToggle} label={t`Only mine`} hint={t`Toggle`} />
        </div>
        <ProgressBar className='mt-6 max-w-md' value={620} total={1000} label={t`voters`} />
        <Timeline className='mt-6'>
          <TimelineRow title={t`Created`} meta='#48476748' tone='ok' />
          <TimelineRow title={t`Batch #${index}`} meta='#48477140' tone='ok' />
          <TimelineRow title={t`Results`} meta='—' tone='muted' last />
        </Timeline>
        <div className='mt-6'>
          <Tabs
            items={[
              {
                value: 'a',
                label: t`Overview`,
                content: (
                  <p className='text-[13px] text-ash'>
                    <Trans>Tab one.</Trans>
                  </p>
                ),
              },
              {
                value: 'b',
                label: t`Batches`,
                meta: 12,
                content: (
                  <p className='text-[13px] text-ash'>
                    <Trans>Tab two.</Trans>
                  </p>
                ),
              },
            ]}
          />
        </div>
        <div className='mt-6 flex items-center gap-3'>
          <Skeleton className='h-4 w-40' />
          <Button onClick={() => setDialogOpen(true)}>
            <Trans>Open dialog</Trans>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={t`Dialog`} description={t`A modal panel.`}>
            <p className='text-[13px] text-ash'>
              <Trans>Content.</Trans>
            </p>
          </Dialog>
        </div>
      </Panel>

      <Card>
        <Stat label={t`Empty state`} value='' />
        <EmptyState
          compact
          title={t`Nothing here yet`}
          description={t`What a panel shows when the chain has nothing to show.`}
        />
      </Card>
    </Stack>
  )
}
