# Translations

The explorer speaks English, Spanish and Catalan. The English text lives in
the code, written through the Lingui v5 macros; the
English text is the message id, so there are no keys to invent. The
translations live in `src/locales/<locale>/messages.po`, one catalog per
language, loaded lazily: a visitor downloads only the one they read. The
words to use are in [`src/locales/GLOSSARY.md`](../src/locales/GLOSSARY.md).

## The loop

1. Write the English inline, through a macro (below).
2. `pnpm i18n:extract` adds, updates and removes the messages in every
   catalog. English fills itself; Spanish and Catalan get empty entries.
3. Translate the empty `msgstr` of `es` and `ca`, by hand or in a PO editor,
   with the glossary. Keep the placeholders (`{total}`), the plural and
   select arguments and the tags (`<0>…</0>`) exactly as in the English.
4. `pnpm i18n:check`, which CI runs: it fails when extraction would change a
   catalog (text added or edited without extracting) and when a Spanish or
   Catalan entry is empty or has lost a placeholder, a plural or a tag.

Code and catalogs land in the same change. When two branches both touched
the catalogs, resolve the conflict by keeping both sides and run
`pnpm i18n:extract` again. The catalogs list file paths without line numbers,
so moving code around does not change them.

## Which macro where

| Where the text is | Use |
|---|---|
| JSX text | `<Trans>` from `@lingui/react/macro` |
| A sentence or paragraph with links, `<code>` or emphasis | one `<Trans>` around all of it; the elements become `<0>…</0>` for the translator |
| Attributes (`aria-label`, `title`, `placeholder`), string props, tooltip text | `const { t } = useLingui()` from `@lingui/react/macro`, then `` t`…` `` |
| Props that take a node (`title`, `description`, `label` of `Panel`, `Callout`, `EmptyState`, `StatCell`) | `` t`…` `` for plain text, `<Trans>` when it has markup |
| A count | `<Plural value={n} one='# process' other='# processes' />` in JSX, `plural(n, { … })` inside `` t`…` `` |
| A function that runs while rendering, outside a component (selectors, `describeCell`, `resolveSearch`) | `` t`…` `` from `@lingui/core/macro` |
| A table or constant at module scope | `` msg`…` `` from `@lingui/core/macro`, rendered with `i18n._(descriptor)` (`const { i18n } = useLingui()`) |
| Table columns with headers and tooltips | build the column array in the component, in a `useMemo` on `t` |
| A failure shown to people | `` new ServiceError(msg`…`) ``: its message translates on read |
| The same English with two meanings | `msg({ message: 'results', context: 'process phase' })`, or `t({ … })` |

From the code, a paragraph with markup and a variable
(`src/app/StatusBanners.tsx`):

```tsx
<Trans>
  The RPC endpoint reports chain id <span className='font-mono text-ghost'>{actual}</span>, but this
  explorer is configured for <span className='font-mono text-ghost'>{expected}</span> ({networkName}).
  Nothing is indexed until <code>RPC_URL</code> and <code>CHAIN_ID</code> agree.
</Trans>
```

The catalog shows the translator `The RPC endpoint reports chain id
<0>{actual}</0>, but this explorer is configured for <1>{expected}</1>
({networkName}). Nothing is indexed until <2>RPC_URL</2> and <3>CHAIN_ID</3>
agree.`

Strings for attributes and props (`src/pages/processes/index.tsx`):

```tsx
const { i18n, t } = useLingui()
// …
<Input
  label={t`Search`}
  aria-label={t`Search processes by id or organizer`}
  placeholder={t`Process id or organizer, or part of one`}
/>
```

A count and its sentence as one message, with a test id kept on part of it:

```tsx
<Trans>
  <span data-testid='process-count' className='font-medium text-silver'>
    <Plural value={count} one='# process' other='# processes' />
  </span>{' '}
  <Plural value={count} one='matches' other='match' />, of {total} on the registry.
</Trans>
```

A table at module scope (`src/app/ThemeToggle.tsx`):

```tsx
const OPTIONS: Array<{ value: ThemePreference; label: MessageDescriptor; icon: ReactNode }> = [
  { value: 'system', label: msg`System theme`, icon: <MonitorIcon size={14} /> },
  // …
]

export function ThemeToggle() {
  const { i18n, t } = useLingui()
  // …
  const label = i18n._(o.label)
```

Text made in a selector while a page renders (`src/indexer/selectors.ts`):

```ts
const count = ev.data.count
label: t`Tally sent to the DKG committee (${plural(count, { one: '# ciphertext', other: '# ciphertexts' })})`
```

### The shared protocol tables

`PROCESS_STATUS_INFO`, `CENSUS_ORIGIN_INFO`, `KEY_MODE_INFO`,
`BATCH_REGISTERS`, `BATCH_FAIL_BITS`, `RESULTS_FAIL_BITS` and `PIN_LABELS`
(`src/protocol/`) are built from `msg` descriptors, but their text fields
translate on read (`withText` in `src/i18n/text.ts`): `KEY_MODE_INFO[m].label`
is already a string in the active language. Read those fields while
rendering. At module scope (`const LABELS = MODES.map((m) => KEY_MODE_INFO[m].label)`)
the text would be read once, in whatever language was active then. The same
goes for anything else that translates: keep descriptors at module scope and
translate in the component.

### Rules that keep the catalogs readable

- Interpolate variables, not expressions. `` t`${formatNumber(n)} in total` ``
  becomes `{0} in total`, which says nothing to the translator; name it
  first: `` const total = formatNumber(n) `` then `` t`${total} in total` ``.
- One whole sentence per message. Never glue translated fragments together
  or lowercase a translated label to put it inside another sentence: word
  order and agreement differ between languages.
- A paragraph of prose is one message, not one per sentence, so the
  translator sees the whole thought.
- Give short labels room: Spanish and Catalan run longer than English. Let a
  badge or a header wrap or truncate (`headerWrap` in a column's `meta`)
  rather than size it for English, and look at the page in all three.
- No explicit `id`: the English is the id. Add a `context` only when the same
  English means two different things, as `results` does for a process phase
  and for a kind of registry event (`src/pages/overview/ActivityPanel.tsx`).

## Numbers, dates and times

Everything in `~lib/format` follows the active language through `Intl`:
`formatNumber`, `formatPercent`, `formatShare`, `formatCompact`,
`formatBytes`, `formatWei`, `formatGwei`, `formatList`, `formatDuration`,
`formatTimestamp`, `formatDate` and `timeAgo`. `Timestamp`, `NativeAmount`,
the charts and `Pagination` use them. Format a number before interpolating
it, or let a plural's `#` format the count. Never format for display with
`toLocaleString()` without a locale, `toFixed`, or an ISO string. Block
numbers, chain ids and indices are identifiers and are printed as they are.

## What stays as it is

Hex values, addresses, hashes, register names, fail-bit names, contract,
function and event names, environment variables, commands and code, product
names. Put them in the message as a placeholder or inside a `<code>` tag, so
the translator keeps them. A formula goes through `Formula` with its `expr`
prop (`<Formula expr='sha256(commitment ‖ y …)' />`): inside a `<Trans>` it
becomes an empty `<0/>` tag, so the catalog holds the sentence and not the
formula. Not translated at all: `console` output, errors
that never reach the page, test names and config keys. A failure shown to
people gets a translated sentence; the technical detail that comes with it
(an RPC's own error text) is shown as it came.

Organizer content is not interface text: a process's metadata carries its
own languages (`{ default, es, ca }`), and the demo fixture publishes all
three.

## How a switch works

`src/i18n/` holds the runtime. `main.tsx` loads the catalog of the first
language before the first render: the stored choice
(`localStorage['davinci-explorer:locale']`), else the first browser language
the explorer speaks, else English. `switchLocale` (the top-bar selector)
stores the choice, loads the catalog, activates it and sets `<html lang>`.
`RemountOnLocaleChange` remounts everything under the router, so text built
in memos, selectors and formatters is built again; the data layer and the
query cache above it keep running.

## Tests

- Unit tests run in English, and every `render` and `renderHook` gets the
  Lingui provider (`vitest.setup.ts`), so a test renders a component with no
  extra wiring. To test another language, `await activateLocale('es')` and
  switch back in `afterEach` (see `src/app/shell.test.tsx`).
- `src/locales/catalogs.test.ts` checks every translation against its English.
- Playwright runs in English. `tests/e2e/i18n.spec.ts` switches languages
  and reads the shell, the overview and the lists; each area has its own spec
  beside it: `i18n-learn.spec.ts` (the guide and the glossary),
  `i18n-process.spec.ts`, `i18n-transition.spec.ts` (with the vote check) and
  `i18n-contracts.spec.ts` (with the sequencers). When you translate a page,
  add a test to its area's spec that reads it in Spanish or Catalan, or start
  an `i18n-<area>.spec.ts` for a new area.

## Adding a language

1. Add it to `LOCALES` and `LOCALE_NAMES` in `src/i18n/locales.ts` (the
   Lingui config reads the same list); a browser asking for it by its
   primary subtag gets it.
2. `pnpm i18n:extract` creates `src/locales/<locale>/messages.po`.
3. Add a column to the glossary and translate the catalog.
4. `pnpm i18n:check`.
