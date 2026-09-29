import { Link } from 'react-router'
import { ProcessIdLink } from './values'
import { UnverifiedMark } from './Unverified'
import { useMetadataCheck } from '~data/queries'
import type { Hex } from '~indexer/types'
import { paths } from '~routes/paths'
import { metadataTitle } from '~pages/process/metadata'

/**
 * The title from the process's metadata over its short id; the id alone until
 * a title loads, or without one. A title from a document that does not match
 * the on-chain hash carries the unverified mark.
 */
export function ProcessName({
  id,
  metadataURI,
  metadataHash,
}: {
  id: string
  metadataURI: string | null
  metadataHash: Hex | null
}) {
  const metadata = useMetadataCheck(metadataURI, metadataHash)
  const title = metadataTitle(metadata.doc)
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      {title ? (
        <span className='flex min-w-0 items-center gap-1.5'>
          <Link to={paths.process(id)} title={title} className='truncate text-[13px] text-ghost hover:text-emerald'>
            {title}
          </Link>
          {metadata.status !== 'matches' ? <UnverifiedMark /> : null}
        </span>
      ) : null}
      <ProcessIdLink id={id} chars={8} />
    </div>
  )
}
