import { useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { Link, NavLink, useLocation } from 'react-router'
import { NAV_ITEMS, paths, type NavItem } from '~routes/paths'
import { Button, CloseIcon, MenuIcon, PageContainer } from '~kit'
import { cn } from '~lib/cn'
import { ChainPill } from './ChainPill'
import { GlobalSearch } from './GlobalSearch'
import { LanguageSelect } from './LanguageSelect'
import { ThemeToggle } from './ThemeToggle'

function isActive(pathname: string, match: string): boolean {
  return match === '/' ? pathname === '/' : pathname === match || pathname.startsWith(`${match}/`)
}

/**
 * Sticky top bar: brand, primary nav, global search, chain identity,
 * language and theme. Below 1380 px the search and the chain identity take a
 * row of their own; below 1024 px the nav folds into a disclosure. The
 * language and theme switches stay in the bar.
 */
export function TopBar() {
  const { i18n, t } = useLingui()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  const navLink = (item: NavItem, mobile = false) => {
    const active = isActive(pathname, item.match)
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={mobile ? () => setOpen(false) : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'text-[13px] font-medium transition-colors',
          // The call to action: an accent pill, filled while you are on it. In
          // the phone menu its text lines up with the rows above (12 px, less
          // the 1 px border).
          item.primary
            ? cn(
                'rounded-pill border',
                mobile ? 'mt-1 w-fit px-[11px] py-1.5' : 'ml-2 px-3.5 py-1',
                active
                  ? 'border-emerald bg-emerald text-on-accent'
                  : 'border-emerald/60 text-emerald hover:border-emerald hover:bg-emerald/10'
              )
            : cn(
                'rounded-sm',
                mobile ? 'px-3 py-2' : 'px-3 py-1.5',
                active ? 'text-emerald' : 'text-pewter hover:text-ghost'
              )
        )}
      >
        {i18n._(item.label)}
      </NavLink>
    )
  }

  return (
    <header className='sticky top-0 z-40 border-b border-charcoal bg-obsidian/90 backdrop-blur-md'>
      <PageContainer className='flex h-14 items-center gap-4'>
        <Link to={paths.home()} className='flex shrink-0 items-center gap-2' aria-label={t`DAVINCI explorer home`}>
          <span className='text-[15px] font-bold tracking-tight text-emerald'>DAVINCI</span>
          <span className='label-caps hidden rounded-pill border border-emerald/20 bg-emerald/8 px-2 py-[2px] text-[9px] text-emerald sm:inline'>
            explorer
          </span>
        </Link>

        <nav aria-label={t`Primary`} className='hidden shrink-0 items-center gap-0.5 lg:flex'>
          {NAV_ITEMS.map((item) => navLink(item))}
        </nav>

        <div className='ml-auto flex min-w-0 items-center gap-3'>
          <GlobalSearch id='global-search' className='hidden w-72 min-w-32 shrink min-[1380px]:block' />
          <ChainPill className='hidden min-[1380px]:flex' />
          <LanguageSelect />
          <ThemeToggle />
          <Button
            size='icon'
            variant='subtle'
            className='lg:hidden'
            aria-label={open ? t`Close menu` : t`Open menu`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </Button>
        </div>
      </PageContainer>

      <PageContainer className='flex items-center gap-3 pb-3 min-[1380px]:hidden'>
        <GlobalSearch id='global-search-compact' className='min-w-0 flex-1' />
        <ChainPill className='hidden shrink-0 md:flex' />
      </PageContainer>

      {open ? (
        <PageContainer className='border-t border-charcoal py-2 lg:hidden'>
          <nav aria-label={t`Primary`} className='flex flex-col'>
            {NAV_ITEMS.map((item) => navLink(item, true))}
          </nav>
          <div className='mt-2 border-t border-charcoal pt-3 md:hidden'>
            <ChainPill className='w-fit' />
          </div>
        </PageContainer>
      ) : null}
    </header>
  )
}
