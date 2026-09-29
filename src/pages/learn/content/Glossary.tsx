import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useLocation } from 'react-router'
import { Formula } from '~components/Formula'
import { HashLink } from '~components/HashLink'
import { RichText } from '~components/RichText'
import { EmptyState, Input } from '~kit'
import { cn } from '~lib/cn'
import { filterGlossary, readGlossary } from '~content/glossary'
import { P } from '../prose'

/** Every term: the plain definition first, then the full one with its mechanism and formula. */
export function Glossary() {
  const { i18n, t } = useLingui()
  const [query, setQuery] = useState('')
  const entries = filterGlossary(query, readGlossary(i18n))
  const { hash } = useLocation()
  const target = hash.startsWith('#term-') ? decodeURIComponent(hash.slice('#term-'.length)) : null
  return (
    <>
      <P className='mt-0'>
        <Trans>
          Each word has a plain definition first, the one a dotted word shows on hover anywhere in the explorer, and the
          exact one below it, with the names and formulas an auditor needs.
        </Trans>
      </P>
      <Input
        type='search'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t`Filter the glossary`}
        aria-label={t`Filter the glossary`}
        wrapperClassName='max-w-sm'
      />
      {entries.length === 0 ? (
        <EmptyState compact title={t`No term matches`} description={t`Try a shorter word, or clear the filter.`} />
      ) : (
        <dl className='mt-6 flex flex-col divide-y divide-charcoal' data-testid='glossary'>
          {entries.map((e) => (
            <div
              key={e.id}
              id={`term-${e.id}`}
              aria-current={e.id === target ? 'true' : undefined}
              className={cn('scroll-mt-20 py-4', e.id === target && '-mx-3 rounded-md bg-emerald/[0.06] px-3')}
            >
              <dt className='text-[15px] font-semibold text-ghost'>
                <HashLink id={`term-${e.id}`} className='hover:text-emerald'>
                  {e.term}
                </HashLink>
              </dt>
              <dd className='mt-1 text-[14px] leading-[1.7] text-silver' data-testid='glossary-short'>
                <RichText text={e.short} />
              </dd>
              <dd className='mt-2 border-l-2 border-charcoal pl-3 text-[13px] leading-[1.7] text-pewter'>
                <RichText text={e.text} />
                {e.formula ? <Formula block expr={e.formula} className='my-2' /> : null}
                {e.see ? (
                  <Link
                    to={e.see.to}
                    className={cn(
                      'text-[13px] whitespace-nowrap text-ash underline-offset-3 hover:text-emerald hover:underline',
                      e.formula ? 'block' : 'ml-1'
                    )}
                  >
                    {e.see.label} →
                  </Link>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
