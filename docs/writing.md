# Writing for the explorer

Who reads these pages: voters, organizers, observers and auditors. Assume the
reader is not technical until they open a detail. The protocol is technical
and the explorer keeps every detail; it just puts the meaning first and the
mechanism one step further down.

This guide covers the words and the layout. How a string reaches the
translation catalogs is in [translations.md](translations.md); the components
are described in [architecture.md](architecture.md#kit-and-components).

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
   41 votes". A bare number needs a label next to it.
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

One plain word per concept, the same on every page. Lead text (a panel's
description, a check's title and summary, the first sentence of a callout or
a tooltip, an empty state) and labels use the plain word. The technical term
belongs to the details layer, or appears once in brackets where the reader
will meet it again in a label, a command or a table header: "a batch of
votes (a state transition)". Never use two plain words for one thing.

| Concept                                        | Plain word                                                                                   | Technical term (details layer)                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| a vote as a whole, from its rules to results   | election (see below for process)                                                             | process, `processId`                                   |
| the votes a sequencer proves and sends at once | batch, "a batch of votes"; its page is "Batch #12"                                           | state transition, transition                           |
| the registry accepting a batch or results      | recorded (on the chain)                                                                      | settle, settlement, `submitStateTransition`            |
| where it is recorded                           | on the chain                                                                                 | on-chain                                               |
| what a voter casts, and what is counted        | vote ("41 votes")                                                                            |                                                        |
| what a vote carries, encrypted                 | ballot (a ballot's answers, the ballot rules, a ballot proof)                                | ciphertexts, ballot mode                               |
| a later vote by the same voter                 | changed vote; the action is "vote again"                                                     | overwrite, `overwrittenVotesCount`                     |
| a re-encryption of a ballot nobody changed     | silent refresh                                                                               | re-encryption, `Enc(0; r)`                             |
| what the count ends in                         | results                                                                                      | tally                                                  |
| the encrypted sum of every counted ballot      | encrypted total                                                                              | accumulator, leaf `0x04`                               |
| who may vote                                   | list of voters                                                                               | census, census origin                                  |
| hash, digest, root of a tree                   | fingerprint                                                                                  | hash, root, digest, SHA-256, keccak256                 |
| the fingerprint of an election's state         | the fingerprint of the election's state                                                      | state root                                             |
| the first one                                  | the starting fingerprint, before any vote                                                    | genesis root                                           |
| the fingerprint of the list of voters          | the fingerprint of the list of voters                                                        | census root                                            |
| a sequencer's proof that a vote id is included | receipt, "the sequencer's receipt"                                                           | tracker proof                                          |
| the key voters encrypt their ballots to        | election key                                                                                 | encryption key (`encryptionKey`), leaf `0x03`, ElGamal |
| whoever can decrypt                            | key holder: one sequencer, or the key committee                                              | key mode                                               |
| the DKG operators that share a key             | key committee on a page's first mention and in titles; then committee                        | davinci-dkg, DKG, threshold                            |
| one setup of the key committee                 | round; the contracts page, which lists them, says "rounds called epochs" once and then epoch | epoch, pool key                                        |
| the organizer's half of a locked key           | organizer secret                                                                             | `sk_org`, `revealProcessKey`                           |
| the app a voter votes with                     | voting app                                                                                   | client                                                 |
| a blob                                         | published data; "data blobs" when naming or counting them                                    | blob (EIP-4844), KZG commitment                        |
| guest, zkVM program                            | program: the batch program, the results program                                              | guest, vote-batch guest, results guest                 |
| program vk                                     | the program's fingerprint                                                                    | program vk                                             |
| public values, publics                         | what the proof makes public                                                                  | public values, registers                               |
| fail mask                                      | the failed checks (zero when none failed)                                                    | `fail_mask`                                            |
| ciphertext, plaintext                          | encrypted value, decrypted value                                                             | ciphertext, plaintext                                  |
| registry, `ProcessRegistry`                    | the registry                                                                                 | `ProcessRegistry`                                      |

**Election and process.** "Process" is the explorer's name for the record
the registry keeps: the navigation, the Processes list, a process page's
label and tabs, "process id", the filters and columns, and the count of rows
in a list. Running text says "election": "Every vote in this election was
counted once". The Processes list and the process page tie the two in their
first lead ("each process is one election on this registry"), and the
technical details say "process", as the contracts do.

**Counts.** Batches carry votes, and a count of them is a count of votes:
"3 batches, 41 votes". "Ballot" is for what a vote carries: its encrypted
answers, the rules they follow and the proof that they do.

**Labels.** The same words name things in the interface. A process page's
tabs are Overview, Election key, Batches, Votes, Results and Raw (the route
ids stay `key` and `transitions`), and its counters Voters, Changed votes,
Batches and Data blobs. A batch's page is "Batch #12". The key-mode badges
read Sequencer key, Committee, automatic and Committee, organizer-locked; the
kinds of list Fixed list, Updatable list, List kept by a contract and
Credential service provider; the pins Batch program, Results program,
Proving setup, Verifier contract code and Ballot proof key.

Names from the code (`votersCount`, `submitStateTransition`, `leaf 0x04`)
stay exact and in `<code>`, and are never translated.

## Components

### `Term`: a word with its definition

```tsx
import { Term } from '~components/Term'

;<Trans>
  Your <Term id='vote-id'>vote id</Term> is in the published data of this batch.
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
operator), `||` drawn as ‖, and `2^63` or `2^−7.6` as a superscript, a
negative exponent with its sign. `expr` keeps the
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
