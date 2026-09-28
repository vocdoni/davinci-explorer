import type { ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { cn } from '~lib/cn'
import { CopyButton } from './CopyButton'
import { ExternalIcon } from './icons'
import { Tooltip } from './Tooltip'
import { uriHost } from './uri'

export interface UriLinkProps {
  uri: string
  /** The http(s) address that opens it (an `ipfs://` URI through a gateway); null when a browser cannot. */
  href: string | null
  /** What opening it gives, e.g. "Open the document". */
  label: ReactNode
  className?: string
}

/**
 * A long URI as a compact link: what it opens, the host in small type, the
 * full URI in the tooltip and a copy button. A URI no browser can open
 * (`file:`, `data:`, …) shows only where it points, with the same tooltip
 * and copy.
 */
export function UriLink({ uri, href, label, className }: UriLinkProps) {
  const { t } = useLingui()
  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1', className)}>
      <Tooltip content={uri} value>
        {href ? (
          <a
            href={href}
            target='_blank'
            rel='noreferrer noopener'
            className='group inline-flex min-w-0 items-center gap-1.5 text-[13px] text-silver transition-colors hover:text-emerald'
          >
            <span className='whitespace-nowrap underline-offset-2 group-hover:underline'>{label}</span>
            <ExternalIcon size={12} className='shrink-0 text-ash group-hover:text-emerald' />
            <span className='truncate font-mono text-[11px] text-ash'>{uriHost(uri)}</span>
          </a>
        ) : (
          <span tabIndex={0} className='truncate font-mono text-[12px] text-silver'>
            {uriHost(uri)}
          </span>
        )}
      </Tooltip>
      <CopyButton value={uri} label={t`Copy URI`} />
    </span>
  )
}
