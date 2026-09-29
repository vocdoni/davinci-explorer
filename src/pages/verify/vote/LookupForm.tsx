import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate } from 'react-router'
import { ProcessPhaseBadge, UnverifiedMark } from '~components'
import { useProcesses, useStore } from '~data/hooks'
import { useTransitionBlobs } from '~data/queries'
import { Button, Card, Input } from '~kit'
import { formatVoteId } from '~protocol/blob'
import { paths } from '~routes/paths'
import { useProcessTitles, type ProcessTitle } from '../titles'
import { validateLookup } from './lookup'

/**
 * The election and the vote id. Submitting a valid pair opens its URL, so a
 * check can be shared and reloaded.
 */
export function LookupForm({ initialPid, initialVote }: { initialPid: string; initialVote: string }) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const store = useStore()
  const listId = useId()
  const [pid, setPid] = useState(initialPid)
  const [vote, setVote] = useState(initialVote)
  const [touched, setTouched] = useState(false)
  const query = validateLookup(pid, vote)

  const rows = useProcesses()
  const known = useMemo(() => rows.slice(0, 200), [rows])
  const titles = useProcessTitles(known)
  const chosen = query.pid ? rows.find((r) => r.id === query.pid) : undefined
  const chosenTitle = chosen ? titles.get(chosen.id) : undefined
  // A native list cannot carry the mark, so an unverified title says so in words.
  const optionLabel = (named: ProcessTitle | undefined) => {
    if (!named) return undefined
    const title = named.title
    return named.verified ? title : t`${title} (unverified)`
  }

  // The newest settled transition, for the example.
  const latest = useMemo(() => {
    const key = store.transitionOrder[store.transitionOrder.length - 1]
    return key ? store.transitions[key]! : null
  }, [store])
  const [wantExample, setWantExample] = useState(false)
  const example = useTransitionBlobs(latest?.processId, latest?.index, { enabled: wantExample })
  const exampleId = example.data?.decoded?.voteIds[0]

  useEffect(() => {
    if (!wantExample || !latest || exampleId == null) return
    setWantExample(false)
    navigate(paths.vote(latest.processId, formatVoteId(exampleId)))
  }, [wantExample, latest, exampleId, navigate])

  const exampleFailed = wantExample && (example.error != null || (example.data != null && exampleId == null))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (query.pid && query.voteId != null) navigate(paths.vote(query.pid, formatVoteId(query.voteId)))
  }

  return (
    <Card className='p-5 sm:p-6'>
      <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
        <div className='grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'>
          <div className='min-w-0'>
            <Input
              label={t`Election`}
              mono
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              placeholder={t`Pick from the list, or paste the id (0x…)`}
              list={listId}
              autoComplete='off'
              spellCheck={false}
              error={touched ? query.pidError : undefined}
              hint={t`The election you voted in: its process id, 0x and 62 hex digits.`}
            />
            <datalist id={listId}>
              {known.map((p) => (
                <option key={p.id} value={p.id} label={optionLabel(titles.get(p.id))} />
              ))}
            </datalist>
            {chosen ? (
              <p
                className='mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-silver'
                data-testid='lookup-election'
              >
                <span className='truncate'>{chosenTitle?.title ?? t`An election without a title`}</span>
                {chosenTitle && !chosenTitle.verified ? <UnverifiedMark /> : null}
                <ProcessPhaseBadge phase={chosen.phase} />
              </p>
            ) : null}
          </div>
          <Input
            label={t`Vote id`}
            mono
            value={vote}
            onChange={(e) => setVote(e.target.value)}
            placeholder='0x8000000000000001'
            autoComplete='off'
            spellCheck={false}
            error={touched ? query.voteError : undefined}
            hint={t`0x and 16 hex digits, from your voting app.`}
          />
        </div>
        <div className='flex flex-col gap-3 border-t border-charcoal pt-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ash'>
            <Button
              size='sm'
              variant='subtle'
              disabled={!latest}
              loading={wantExample && !exampleFailed}
              onClick={() => setWantExample(true)}
            >
              <Trans>Try an example</Trans>
            </Button>
            <span>
              {latest
                ? exampleFailed
                  ? t`The newest batch’s data could not be read, so there is no example to show.`
                  : t`No vote id at hand? This fills in a vote from the newest recorded batch.`
                : t`No batch has been recorded yet, so there is no example.`}
            </span>
          </div>
          <Button type='submit' variant='primary' size='lg' className='justify-center'>
            <Trans>Check this vote</Trans>
          </Button>
        </div>
      </form>
    </Card>
  )
}
