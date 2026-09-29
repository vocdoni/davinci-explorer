# Writing for the explorer

Who reads these pages: voters, organizers, observers and auditors. Assume the
reader is not technical until they open a detail. The protocol is technical
and the explorer keeps every detail; it just puts the meaning first and the
mechanism one step further down.

This guide covers the words and the layout. How a string reaches the
translation catalogs is in [translations.md](translations.md); the components
are described in [EXPLORER.md](../EXPLORER.md).

## The rules

1. **Lead with the meaning.** The first sentence of a card, section, tooltip
   or check says what it means for the reader, in everyday words: "Your vote
   is counted in this batch", "Nobody changed the rules after the election
   started". The mechanism comes after.
2. **Layer, never delete.** A plain lead, then a disclosure ("How this is
   checked", "Technical details") with the mechanism, the exact values and
   the command, then the raw data. Detail that exists today moves down a
   layer; it is not removed.
3. **Short and concrete.** One idea per sentence, active voice, no stacked
   clauses. Explain a term the first time a page uses it, or wrap it in
   `<Term>` so the definition is one hover away.
4. **Plain name first, technical name second**, the latter in code style when
   it is an identifier: "the program that checks each batch
   (`batchProgramVK`)", "a batch of votes (a state transition)". Keep
   identifiers exact.
5. **Formulas** always through `<Formula expr='…' />`, never pseudo-code in
   prose, never a raw `||`, `^` or `*`, never a back-ticked expression.
   Hashes, addresses and ids go through the kit (`Hash`, `Address`,
   `ProcessIdLink`, `TxLink`).
6. **Numbers carry their meaning**: "22 of at most 50 voters", "3 batches,
   41 ballots". A bare number needs a label next to it.
7. **Visual structure**: short paragraphs; a list for steps or rules; at most
   one bold phrase per paragraph, for the key point. Callout tones mean the
   same everywhere (below). Status colours come only from the badge and check
   components and the theme tokens. Add colour and structure where it helps
   scanning (an "In short" lead on a long page, icons on callouts, step
   numbers), not as decoration.
8. **Tone**: plain, calm, precise. No marketing, no exclamation marks,
   sparing em-dashes.
9. **Translatable**: whole sentences per message, named placeholders, no
   fragments glued together ([translations.md](translations.md)).

## Words

Use the plain word on first mention and the technical one in brackets when
the reader will meet it again (in a label, a command, a table header). After
that either is fine, but stay consistent within a page.

| Technical                      | Plain                                            |
| ------------------------------ | ------------------------------------------------ |
| hash, digest, root (of a tree) | fingerprint                                      |
| state root                     | the fingerprint of the process's state           |
| genesis root                   | the starting fingerprint, before any vote        |
| state transition               | a batch of votes; "settled batch" once on chain  |
| settle, settlement             | record on chain (the registry accepts the batch) |
| registry, `ProcessRegistry`    | the registry, the voting contract                |
| ciphertext, plaintext          | encrypted value, decrypted value                 |
| accumulator                    | the encrypted running total                      |
| tally                          | the count, the results                           |
| census                         | the list of voters                               |
| census root                    | the fingerprint of the list of voters            |
| overwrite                      | a changed vote (a revote)                        |
| silent refresh                 | a fresh encryption of a ballot nobody changed    |
| key mode                       | who holds the key                                |
| election key, encryption key   | the key voters encrypt their ballots to          |
| program vk                     | the program's fingerprint                        |
| public values, publics         | what the proof makes public                      |
| fail mask                      | the failed checks (zero when none failed)        |
| guest                          | the proven program                               |
| blob                           | data blob (published data)                       |
| on-chain                       | on the chain, recorded on chain                  |

Names from the code (`votersCount`, `submitStateTransition`, `leaf 0x04`)
stay exact and in `<code>`, and are never translated.

## Components

### `Term`: a word with its definition

```tsx
import { Term } from '~components/Term'

;<Trans>
  Your <Term id='vote-id'>vote id</Term> is in the blob of this batch.
</Trans>
```

The words keep their place in the sentence (and in the translation); the
tooltip shows the glossary entry's `short` definition, on hover and on
keyboard focus. A click opens the entry at `/learn/glossary#term-<id>`; on a
touch screen the first tap shows the definition and the second opens the
entry. `id` is typed (`GlossaryId`), so a missing entry fails the type check.

- Use it on the first use of a key term per page, not on every use.
- Never inside a link, a button, a badge or another tooltip's trigger.
- A term the glossary lacks: add an entry to `src/content/glossary.ts` with
  its `short` (one or two plain sentences, under 200 characters, what a
  reader needs in the middle of a sentence) and its `text` (the full
  definition, mechanism included).
- `short` names no cryptography: no curve, hash or proof-system names, no
  register numbers. Those go in `text`, and an expression the definition
  refers to goes in `formula`, which the glossary page shows with `Formula`
  under the text. The glossary page shows `short` first and `text` below it,
  so `text` continues the definition rather than repeating it.

### `Formula`: an expression

```tsx
<Trans>
  The digest is <Formula expr='sha256(commitment₀ ‖ y₀ ‖ …)' />, and a vote id is at least <Formula expr='2^63' />.
</Trans>
```

Mono font, one colour per kind of token (function, name, literal,
operator), `||` drawn as ‖ and `2^63` as a superscript. `expr` keeps the
formula out of the catalog: inside a `<Trans>` it becomes an empty `<0/>`
tag. `block` sets a formula apart on its own line, for the one a paragraph is
about. A formula in a string table (a register's meaning, a check's detail)
goes in its own field rendered with `Formula`, never inside the translated
text.

### `InShort`: the lead of a long page

```tsx
<InShort>
  <Trans>Every vote in this election is counted once, and the count below is the one the chain accepted.</Trans>
</InShort>
```

Two to four short sentences, or a short list, at the top of a page or a
long panel. It carries the accent bar, not a status colour.

### Callout tones

| Tone           | Meaning                             | Icon    |
| -------------- | ----------------------------------- | ------- |
| `info`         | context the reader should know      | info    |
| `ok`           | something was verified              | check   |
| `warn` (amber) | attention: nothing failed, but look | warning |
| `danger`       | a failure                           | cross   |

Checks use the same four states: `CheckMark` (`pass`, `fail`, `unknown`) and
the Verify flows' `VerifyStatus` (`pass`, `fail`, `attention`, `pending`,
`na`). Keep `danger`, `fail` and red for real failures.

### Layers

- The lead: a sentence in the panel's `description`, the `InShort` box, or
  the first sentence of a callout.
- The mechanism: `Disclosure` from `~components/code`, with the summary
  "How this is checked" for a check and "Technical details" for anything
  else. It renders its body only when open.
- The raw data: `CodeBlock`, the Raw tab, the JSON views.
- An `Explain` glyph (the info icon) holds one or two sentences about a
  label; longer text belongs in a disclosure.
- `NumberedList` for steps and rules in order.
- A page where every row has a mechanism (the contracts page: each
  contract, each pinned value, each wiring check) uses one "Technical
  details" switch, repeated on each panel and shared by all of them, rather
  than a disclosure per row. A table of such rows keeps the layers apart in
  its fields: `what` and `why` plain, `detail` technical, `formula` code
  (`PIN_DETAILS` in `pages/contracts/model.ts`).

### The guide

The Learn topics are written for a curious voter first. Each topic opens
with an `InShort`; each section explains in plain paragraphs what happens and
why, and ends with `Details` (`pages/learn/prose.tsx`, a "Technical details"
disclosure) holding the mechanism for an auditor: contract calls, curve and
proof-system names, register numbers, formulas. Every fact the plain text
leaves out is in the section's `Details`. A walk-through numbers its sections
(`<Section n={1}>`), and the topic list numbers them the same way.

## Before and after

> The last 4 bytes of keccak256(chainId ‖ registry address). The registry
> refuses ids with another prefix, so an id cannot be replayed on another
> chain or registry.

becomes a plain lead plus the formula:

> Ties the id to this registry and chain, so it cannot be used anywhere
> else. It is the last 4 bytes of `keccak256(chainId ‖ registry)`.

with the expression through `Formula`, and

> The registry requires maxValue × maxVoters to stay within 10^12, so any
> tally stays inside the bounded search that decrypts it.

becomes

> The largest total one option could reach if every voter gave it the
> maximum. The registry keeps it at or below 10¹², so the final count can
> always be decrypted: `maxValue × maxVoters ≤ 10^12`.
