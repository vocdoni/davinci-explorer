import { useMemo, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { CensusOriginBadge, CheckMark, Explain, KeyModeBadge, NativeAmount, ProcessPhaseBadge } from '~components'
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
  type AnyColumnDef,
} from '~kit'
import { Donut, Sparkline, StackedBars } from '~kit/charts'
import { formatNumber } from '~lib/format'
import { useTheme } from '~theme/theme-context'

const SAMPLE_ADDRESS = '0x3cde68c39e26ecf94bd029b6ed3b9f945441daf3'
const SAMPLE_PID = '0x42fc20654efd78c6887ff0bd1cc50c9ec1dab58980c5bb9300000000000004'
const SAMPLE_TX = `0x${'9f'.repeat(32)}`

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
      { id: 'blobs', header: t`Blobs`, accessorKey: 'blobs', meta: { numeric: true } },
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
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <Badge tone='ok' dot>
            <Trans>live</Trans>
          </Badge>
          <Badge tone='accent'>
            <Trans>accent</Trans>
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
          <ProcessPhaseBadge phase='open' />
          <ProcessPhaseBadge phase='closed' />
          <ProcessPhaseBadge phase='results' />
          <KeyModeBadge mode='dkg-locked' />
          <CensusOriginBadge origin='csp' />
          <CheckMark state='pass' />
          <CheckMark state='fail' />
          <CheckMark state='unknown' />
          <Explain>
            <Trans>Every value can carry a plain-words explanation.</Trans>
          </Explain>
        </div>
      </Panel>

      <StatRow>
        <StatCell label={t`Processes`} value={formatNumber(12)} mono hint={t`3 open`} />
        <StatCell label={t`Ballots`} value={formatNumber(4210)} mono tone='accent' />
        <StatCell label={t`Blobs`} value={formatNumber(96)} mono />
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

      <Panel title={t`Charts`} description={t`Colours follow the theme through CSS variables.`}>
        <StackedBars
          data={activity}
          series={[
            { key: 'votes', label: t`votes` },
            { key: 'overwrites', label: t`overwrites` },
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
          <TimelineRow title={t`Transition #${index}`} meta='#48477140' tone='ok' />
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
                label: t`Transitions`,
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
