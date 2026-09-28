import { useLingui } from '@lingui/react/macro'
import { ChevronDownIcon, GlobeIcon } from '~kit'
import { LOCALE_NAMES, LOCALES, isLocale } from '~i18n/locales'
import { useLocale } from '~i18n/use-locale'
import { cn } from '~lib/cn'

/**
 * The language switch next to the theme one: a native select (keyboard,
 * screen readers and phones for free) dressed as a top-bar pill. Each
 * language is listed in its own name.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { t } = useLingui()
  const { locale, setLocale } = useLocale()
  return (
    <div
      className={cn(
        'relative inline-flex h-7 shrink-0 items-center rounded-pill border border-charcoal bg-carbon text-ash',
        'transition-colors hover:text-ghost focus-within:border-emerald',
        className
      )}
    >
      <GlobeIcon size={14} className='pointer-events-none absolute left-2' />
      <select
        value={locale}
        onChange={(e) => {
          if (isLocale(e.target.value)) void setLocale(e.target.value)
        }}
        aria-label={t`Language`}
        data-testid='language-select'
        className='h-full cursor-pointer appearance-none rounded-pill bg-transparent pr-6 pl-7 text-[11px] font-medium text-silver focus:outline-none'
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l} className='bg-carbon text-ghost'>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={12} className='pointer-events-none absolute right-2' />
    </div>
  )
}
