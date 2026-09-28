import { Link } from 'react-router'
import { ProcessIdLink } from '~components'
import { useJsonDocument } from '~data/queries'
import { paths } from '~routes/paths'
import { fetchableUri, metadataTitle } from '../process/metadata'

/** The title from the process's metadata over its short id; the id alone until a title loads, or without one. */
export function ProcessName({ id, metadataURI }: { id: string; metadataURI: string | null }) {
  const title = metadataTitle(useJsonDocument(fetchableUri(metadataURI)).data)
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      {title ? (
        <Link to={paths.process(id)} title={title} className='truncate text-[13px] text-ghost hover:text-emerald'>
          {title}
        </Link>
      ) : null}
      <ProcessIdLink id={id} chars={8} />
    </div>
  )
}
