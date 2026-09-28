import { Navigate, useLocation, useParams } from 'react-router'
import { patterns } from './paths'

/** Merges the current query (e.g. `demo=1`) into a target that may carry its own. */
function withSearch(target: string, search: string, drop: string[] = []): string {
  const [path, query = ''] = target.split('?')
  const params = new URLSearchParams(query)
  for (const [k, v] of new URLSearchParams(search)) if (!drop.includes(k) && !params.has(k)) params.set(k, v)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path!
}

/** `/votes?pid=&voteId=` and `/votes/:pid/:voteId`, the old vote lookup: the vote check, same parameters. */
export function LegacyVoteRedirect() {
  const { pid, voteId } = useParams()
  const { search } = useLocation()
  const params = new URLSearchParams()
  if (pid) params.set('pid', pid)
  if (voteId) params.set('voteId', voteId)
  const own = params.toString()
  const target = own ? `${patterns.verifyVote}?${own}` : patterns.verifyVote
  return <Navigate replace to={withSearch(target, search, pid ? ['pid', 'voteId'] : [])} />
}

/** A redirect that keeps the query string and the fragment. */
export function RedirectTo({ to }: { to: string }) {
  const { search, hash } = useLocation()
  return <Navigate replace to={`${withSearch(to, search)}${hash}`} />
}
