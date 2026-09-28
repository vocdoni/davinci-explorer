import { useMemo, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Button, EmptyState, Pagination } from '~kit'
import { unpackBallot, type SlotUpdate } from '~protocol/blob'
import { formatSlotKey } from './cells'
import { CiphertextTable } from './PointValue'

const PAGE = 25

/**
 * Every slot the batch wrote, sorted by key. The ciphertexts stay packed
 * (one cell per point) until someone opens a row: unpacking takes a square
 * root per point.
 */
export function SlotUpdateList({ updates }: { updates: SlotUpdate[] }) {
  const { t } = useLingui()
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const pageCount = Math.max(1, Math.ceil(updates.length / PAGE))
  const current = Math.min(page, pageCount - 1)

  if (updates.length === 0) {
    return <EmptyState compact title={t`No slot updates`} description={t`This batch wrote no ballot slot.`} />
  }

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className='flex flex-col gap-3'>
      <ol className='flex flex-col' data-testid='slot-update-list'>
        {updates.slice(current * PAGE, (current + 1) * PAGE).map((u, j) => {
          const i = current * PAGE + j
          const isOpen = open.has(i)
          const slot = formatSlotKey(u.key)
          const ciphertexts = u.cells.length / 2
          return (
            <li key={u.key.toString()} className='border-b border-charcoal/60 py-2 last:border-b-0'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='inline-flex items-center gap-3'>
                  <span className='w-12 font-mono text-[11px] text-ash tnum'>#{i}</span>
                  <span className='font-mono text-[12px] text-silver tnum'>
                    <Trans>slot {slot}</Trans>
                  </span>
                  <span className='text-[11px] text-ash'>
                    <Plural value={ciphertexts} one='# ciphertext' other='# ciphertexts' />
                  </span>
                </span>
                <Button size='sm' variant='subtle' aria-expanded={isOpen} onClick={() => toggle(i)}>
                  {isOpen ? <Trans>Hide ciphertexts</Trans> : <Trans>Show ciphertexts</Trans>}
                </Button>
              </div>
              {isOpen ? <UnpackedBallot cells={u.cells} /> : null}
            </li>
          )
        })}
      </ol>
      {pageCount > 1 ? (
        <Pagination
          page={current}
          pageCount={pageCount}
          onPageChange={setPage}
          pageSize={PAGE}
          total={updates.length}
        />
      ) : null}
    </div>
  )
}

function UnpackedBallot({ cells }: { cells: SlotUpdate['cells'] }) {
  const result = useMemo(() => {
    try {
      return { ballot: unpackBallot(cells), error: null }
    } catch (err) {
      return { ballot: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [cells])
  if (result.error) {
    const error = result.error
    return (
      <p className='mt-2 text-[12px] text-red'>
        <Trans>Could not unpack: {error}</Trans>
      </p>
    )
  }
  return (
    <div className='mt-2 rounded-sm border border-charcoal bg-obsidian/40 p-2'>
      <CiphertextTable ciphertexts={result.ballot!} />
    </div>
  )
}
