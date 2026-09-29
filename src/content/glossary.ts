// The glossary: every protocol word the explorer uses, with a one-sentence
// plain definition (`short`, what `Term` shows on hover) and the full one
// (`text`, the glossary page). Definitions are plain text with `backtick` code
// spans, so the page can filter them and a translation keeps the spans as they
// are. `id` is the anchor (`/learn/glossary#term-<id>`): English in every
// language, and stable, since pages link to it. See docs/writing.md.

import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { paths } from '~routes/paths'

export interface GlossaryEntry {
  id: string
  /** A plain string is a name from the code (`occupied_before`), never translated. */
  term: MessageDescriptor | string
  /** One or two short sentences in everyday words, for the `Term` tooltip. */
  short: MessageDescriptor
  /** The full definition, with the mechanism and the exact names. */
  text: MessageDescriptor
  /** Where the explorer shows it. */
  see?: { label: MessageDescriptor; to: string }
}

/** A glossary entry in the active language. */
export interface GlossaryItem {
  id: string
  term: string
  short: string
  text: string
  see?: { label: string; to: string }
}

const contracts = (section: string) => `${paths.contracts()}#${section}`

export const GLOSSARY = [
  {
    id: 'accumulator',
    term: msg`Accumulator (results)`,
    short: msg`The running encrypted total of every counted ballot. Only the final one is decrypted, to give the results.`,
    text: msg({
      message:
        'State leaf `0x04`: 16 ElGamal ciphertexts holding the encrypted sum of every counted ballot, one per ballot field. Each batch adds its new ballots, subtracts the ones they overwrite and adds the encryptions of zero of its silent refreshes. Only the final sum is decrypted by the protocol. The holder of the election key could decrypt any intermediate accumulator or ballot in the blobs.',
    }),
    see: { label: msg`How results are produced`, to: paths.learn('results') },
  },
  {
    id: 'application-id',
    term: msg`Application id (aid)`,
    short: msg`The number that ties a DKG-mode process to its committee, so the committee decrypts only for that process.`,
    text: msg({
      message:
        'The davinci-dkg application a DKG-mode process registers: `keccak256(chainid, registry, process id) mod Q`, never zero. It scopes the committee’s decryptions to that process.',
    }),
  },
  {
    id: 'ballot',
    term: msg`Ballot`,
    short: msg`A voter’s answers, encrypted: one encrypted number per option, which nobody can read on its own.`,
    text: msg({
      message:
        '16 ElGamal ciphertexts on the BabyJubJub curve, encrypted under the process key, one per field. Fields beyond the ballot mode’s `numFields` carry the identity.',
    }),
  },
  {
    id: 'ballot-mode',
    term: msg`Ballot mode`,
    short: msg`The rules every ballot must follow: how many options, which values each may take and how much a voter may give in total.`,
    text: msg({
      message:
        'The shape of a valid ballot: how many fields (1 to 16), the minimum and maximum value of a field, the bounds on their sum, whether values must be unique, the group size and the cost exponent. Packed into state leaf `0x02`.',
    }),
    see: { label: msg`Processes`, to: paths.processes() },
  },
  {
    id: 'ballot-proof',
    term: msg`Ballot proof`,
    short: msg`A proof the voter’s app attaches to show that the encrypted ballot follows the rules, without revealing it.`,
    text: msg`The Groth16 proof, of the davinci-circom ballot circuit, that a ballot is a correct encryption for the process. Its public inputs are the voter’s address, the vote id and an inputs hash over the process id, ballot mode, key, ciphertexts and weight.`,
  },
  {
    id: 'ballot-vk-hash',
    term: msg`Ballot VK hash`,
    short: msg`The fingerprint of the key that checks ballot proofs. The registry fixes it, so every process checks ballots the same way.`,
    text: msg({
      message:
        'sha256 of the ballot proof’s verification key: a registry immutable, written into every genesis state as leaf `0x07`. The guest only accepts ballot proofs under the key with this hash.',
    }),
    see: { label: msg`Pinned values`, to: contracts('parameters') },
  },
  {
    id: 'batch',
    term: msg`Batch`,
    short: msg`A group of votes a sequencer proves and settles together, in one transaction.`,
    text: msg`The votes a sequencer proves together as one transition: up to 1024, at most one per ballot slot.`,
  },
  {
    id: 'blob',
    term: msg`Blob`,
    short: msg`A block of data sent with a transaction. Each batch publishes its votes in blobs, so anyone can rebuild the count; nodes delete blobs after about two weeks.`,
    text: msg`An EIP-4844 data blob: 4096 cells of 32 bytes carried next to a transaction. A transition’s blobs publish its vote ids, the slots it wrote and the new encrypted tally. Beacon nodes prune them after about 15 days on Gnosis Chain (16384 epochs of 80 s) and about 18 on Ethereum mainnet.`,
    see: { label: msg`Data availability`, to: paths.learn('blobs') },
  },
  {
    id: 'blob-digest',
    term: msg`Blob digest`,
    short: msg`One fingerprint over all of a batch’s blobs. It ties the published data to the proof.`,
    text: msg({
      message:
        '`sha256(commitment₀ ‖ y₀ ‖ commitment₁ ‖ y₁ ‖ …)` over a transition’s blobs, where each `y` is the blob’s evaluation at its bound point. The guest publishes it in registers 28 to 35; the registry recomputes it from the transaction.',
    }),
  },
  {
    id: 'census',
    term: msg`Census`,
    short: msg`The list of who may vote, and with what weight.`,
    text: msg`Who may vote and with what weight: a Merkle tree (fixed, updatable by the organizer, or held by a contract) or the signatures of a credential service provider.`,
    see: { label: msg`Census origins`, to: paths.learn('census') },
  },
  {
    id: 'census-origin',
    term: msg`Census origin`,
    short: msg`Where a process’s list of voters comes from: a fixed list, a list the organizer can update, a contract, or a credential service.`,
    text: msg({
      message:
        'Which kind of census a process uses: 1 fixed Merkle tree, 2 updatable Merkle tree, 3 on-chain census contract, 4 credential service provider. Chosen at creation, stored in state leaf `0x06`.',
    }),
  },
  {
    id: 'census-root',
    term: msg`Census root`,
    short: msg`A short fingerprint of the list of voters. Every vote in a batch is checked against it.`,
    text: msg`What a batch’s census proofs lead to: the lean-IMT root of a Merkle census, or the CSP signer’s address. The guest publishes it and the registry compares it with the roots the process accepts.`,
  },
  {
    id: 'chaum-pedersen-proof',
    term: msg`Chaum–Pedersen proof`,
    short: msg`A proof that a number is the correct decryption of an encrypted value, without revealing the secret key.`,
    text: msg`A proof that a value is the correct decryption of a ciphertext under a public key, without revealing the secret. The results guest checks 16 of them; each DKG partial decryption proves the same relation for one member’s share.`,
  },
  {
    id: 'committee',
    term: msg`Committee`,
    short: msg`A group of independent operators who hold a key together. Enough of them must cooperate to decrypt; fewer cannot.`,
    text: msg`The davinci-dkg operators of one epoch, drawn by an on-chain lottery. A threshold of them can decrypt under the epoch’s pool keys; fewer cannot.`,
    see: { label: msg`The DKG committee`, to: contracts('dkg') },
  },
  {
    id: 'csp',
    term: msg`CSP (credential service provider)`,
    short: msg`An authority that signs each voter’s credential. Its signature is what lets a voter vote.`,
    text: msg`Census origin 4: an authority that signs each voter’s credential with an ECDSA (secp256k1) key. Its address is the census root; the signed index sets the voter’s slot.`,
  },
  {
    id: 'dkg',
    term: msg`DKG`,
    short: msg`Distributed key generation: a committee creates a key together, so no single member ever knows the whole secret.`,
    text: msg`Distributed key generation. davinci-dkg’s committee jointly generates keys no single member knows and decrypts under them on demand, each step proven with Groth16 on chain.`,
  },
  {
    id: 'encryption-key',
    term: msg`Encryption key (election key)`,
    short: msg`The public key voters encrypt their ballots to. Whoever holds its secret could decrypt them.`,
    text: msg({
      message:
        'A point on the BabyJubJub curve, fixed at creation and pinned in the genesis state as leaf `0x03`. Voters encrypt every ballot field to it with ElGamal, each batch re-encrypts the stored ballots under it, and the final tally is decrypted with its secret. Who holds that secret depends on the key mode.',
    }),
    see: { label: msg`Key modes`, to: paths.learn('key-modes') },
  },
  {
    id: 'epoch',
    term: msg`Epoch`,
    short: msg`One round of the DKG committee: its members are drawn and create a new set of keys.`,
    text: msg`One DKG run: a committee is drawn and deals 16 pool keys; once finalized the epoch is Live and applications can claim keys. Epochs are created at a fixed cadence, or early when the newest pool is nearly spent or the epoch aborted.`,
    see: { label: msg`The DKG committee`, to: contracts('dkg') },
  },
  {
    id: 'fail-mask',
    term: msg`Fail mask`,
    short: msg`A number in a proof whose bits say which checks failed. Zero means every check passed.`,
    text: msg({
      message:
        'Register 1 of the public values: one bit per kind of check the guest failed. The registry requires `ok = 1` and a zero fail mask.',
    }),
  },
  {
    id: 'genesis-root',
    term: msg`Genesis root`,
    short: msg`The fingerprint of a process’s state before any vote. The registry computes it when the process is created.`,
    text: msg`The state root before the first transition, computed by the registry at creation from six leaves: the process id, the ballot mode, the encryption key hash, an empty accumulator, the census origin and the ballot VK hash.`,
  },
  {
    id: 'guest',
    term: msg`Guest`,
    short: msg`A program whose run is proven. One checks each batch of votes, another checks the final count.`,
    text: msg`A program the zkVM proves. The vote-batch guest proves a transition; the results guest proves a sequencer-key tally.`,
  },
  {
    id: 'key-mode',
    term: msg`Key mode`,
    short: msg`Who holds the key the ballots are encrypted to, and so who can decrypt the results.`,
    text: msg`Who holds the key the ballots are encrypted under: one sequencer, a davinci-dkg committee (automatic), or the committee plus an organizer secret (locked).`,
    see: { label: msg`Key modes`, to: paths.learn('key-modes') },
  },
  {
    id: 'kzg-commitment',
    term: msg`KZG commitment`,
    short: msg`A short cryptographic fingerprint of a blob, which lets the chain check the blob’s contents.`,
    text: msg`A 48-byte commitment to a blob’s polynomial. The versioned hash is derived from it, and the point-evaluation precompile checks an opening of the blob against it.`,
  },
  {
    id: 'metadata-hash',
    term: msg`Metadata hash`,
    short: msg`The fingerprint of the process’s description document (title, question, options), stored on chain so any change to it shows.`,
    text: msg({
      message:
        'The SHA-256 of the exact bytes of a process’s metadata document, the file with its title, question and option names. The registry stores it as `metadataHash` beside the document’s address, so anyone can download the document and compare: one changed byte, even a space, gives another hash. The organizer can publish a new version until the end; each one is a `ProcessMetadataUpdated` event.',
    }),
    see: { label: msg`How a process is created`, to: `${paths.learn('how-it-works')}#1-a-process-is-created` },
  },
  {
    id: 'observer',
    term: msg`Observer`,
    short: msg`A sequencer node that follows and re-checks every process but never settles votes itself.`,
    text: msg`A sequencer node without a key: it follows every process, replays every transition from its blobs and serves reads and tracker proofs, but never settles.`,
    see: { label: msg`Sequencers`, to: paths.sequencers() },
  },
  {
    id: 'occupied-before',
    term: 'occupied_before',
    short: msg`How many voters had already voted before a batch. The registry checks it against its own count.`,
    text: msg`Register 42: how many ballot slots were written before the batch. The guest cannot see the tree, so the registry checks it against its own voter count.`,
  },
  {
    id: 'organizer',
    term: msg`Organizer`,
    short: msg`The account that created a process. Only it can pause, extend or cancel it.`,
    text: msg`The account that created a process. Only it can change the process’s status, extend its duration, change its voter limit, publish a new version of its metadata document before the end or, for an updatable census, replace the census.`,
  },
  {
    id: 'organizer-secret',
    term: msg`Organizer secret`,
    short: msg`In the organizer-locked key mode, the organizer’s part of the key. The results cannot be decrypted until it is revealed.`,
    text: msg`In DKG locked mode, the organizer’s half of the process key. The committee cannot decrypt until it is revealed, and losing it loses the results.`,
  },
  {
    id: 'overwrite',
    term: msg`Overwrite (revote)`,
    short: msg`A new vote from someone who had already voted. It replaces their previous vote.`,
    text: msg`A vote for a slot that already holds a ballot. The new ballot replaces the old one in the tally. The blob does not show which occupied slot it was: an overwrite and a silent refresh look the same.`,
    see: { label: msg`Silent revoting`, to: paths.learn('silent-revoting') },
  },
  {
    id: 'plonk-proof',
    term: msg`PLONK proof`,
    short: msg`The small proof the registry checks on chain before it accepts a batch or a result.`,
    text: msg`The succinct proof the registry verifies: a guest’s ZisK proof, wrapped. 768 bytes of proof and 512 bytes of public values at every batch size.`,
  },
  {
    id: 'pool-key',
    term: msg`Pool key`,
    short: msg`One of the keys a DKG committee creates in an epoch. Each DKG-mode process uses one.`,
    text: msg`One of the 16 keys an epoch’s committee deals. Each application, and so each DKG-mode process, claims one.`,
  },
  {
    id: 'process',
    term: msg`Process`,
    short: msg`One election on the registry, from its rules to its results.`,
    text: msg`One election on the registry: its parameters, census, key and state root while it runs, and its results at the end.`,
    see: { label: msg`Processes`, to: paths.processes() },
  },
  {
    id: 'process-id',
    term: msg`Process id`,
    short: msg`A process’s unique number, built from the organizer’s address, the registry and a counter.`,
    text: msg({
      message:
        'A `bytes31`: the organizer’s address (20 bytes), the registry’s 4-byte prefix and a 7-byte per-organizer nonce. An id from another registry or chain is refused.',
    }),
    see: { label: msg`Processes`, to: paths.processes() },
  },
  {
    id: 'program-vk',
    term: msg`Program vk`,
    short: msg`The fingerprint of a proven program. The registry only accepts proofs of the program with this fingerprint.`,
    text: msg({
      message:
        'The verification key of a guest program: what `cargo-zisk setup` prints as its root hash. The registry pins one for the vote-batch guest and one for the results guest, and every proof is checked against its program’s.',
    }),
    see: { label: msg`Pinned values`, to: contracts('parameters') },
  },
  {
    id: 'public-values',
    term: msg`Public values (publics)`,
    short: msg`The numbers a proof makes public, such as the state before and after a batch and whether every check passed.`,
    text: msg`The guest’s 64 output registers, each as an 8-byte little-endian word: 512 bytes holding the roots, counts, census root, blob digest and verdict. The verifier binds the proof to them.`,
  },
  {
    id: 're-encryption',
    term: msg`Re-encryption`,
    short: msg`Changing how an encrypted ballot looks without changing what it says, so nobody can link it to the ballot that was sent.`,
    text: msg`Adding an encryption of zero with a fresh scalar to a ciphertext: the same plaintext, a new ciphertext. Every stored ballot is re-encrypted with scalars derived from the batch’s secret seed. Without the seed nobody can match a sent ballot to the stored one; it does not hide whose slot it is.`,
    see: { label: msg`Silent revoting`, to: paths.learn('silent-revoting') },
  },
  {
    id: 'root-c-vadcop-final',
    term: 'rootCVadcopFinal',
    short: msg`The fingerprint of the ZisK proving setup every proof is wrapped with. The registry fixes it.`,
    text: msg`The root of the ZisK vadcop-final setup the proofs are wrapped with, pinned by the registry next to the program vks. It changes with the ZisK setup, not with the guests.`,
    see: { label: msg`Pinned values`, to: contracts('parameters') },
  },
  {
    id: 'sequencer',
    term: msg`Sequencer`,
    short: msg`A node that collects votes, proves them in batches and settles them on chain. Anyone can run one.`,
    text: msg`A node that collects ballots, proves them in batches and settles them on the registry. Settlement is permissionless, so any number can serve a process.`,
    see: { label: msg`Sequencers`, to: paths.sequencers() },
  },
  {
    id: 'silent-refresh',
    term: msg`Silent refresh`,
    short: msg`A fresh encryption of a stored ballot that did not change. Batches add them so that a changed vote cannot be told apart.`,
    text: msg`A re-encryption of an occupied slot the batch did not write. Every batch carries enough of them that an overwrite looks like routine noise. A slot’s first write stays public, since refreshes only touch occupied slots.`,
    see: { label: msg`Silent revoting`, to: paths.learn('silent-revoting') },
  },
  {
    id: 'slot',
    term: msg`Slot`,
    short: msg`The place in a process’s state where one voter’s ballot is kept.`,
    text: msg({
      message:
        'The key of a voter’s ballot in the state tree, between `0x10` and 2^63: derived from the voter’s address for a Merkle census, `0x10` plus the signed index for a CSP.',
    }),
    see: { label: msg`Ballot slots`, to: paths.learn('census') },
  },
  {
    id: 'state-root',
    term: msg`State root`,
    short: msg`A short fingerprint of a process’s whole state: every vote id, every ballot and the encrypted total.`,
    text: msg`The root of a process’s state tree, a SHA-256 sparse Merkle tree of 64 levels holding the process configuration, every vote id, every ballot and the encrypted tally. The registry keeps the latest one; each transition moves it.`,
  },
  {
    id: 'state-transition',
    term: msg`State transition`,
    short: msg`One settled batch of votes. It moves the process’s state from one fingerprint to the next.`,
    text: msg({
      message:
        'One settled batch: the root before, the root after, the proof and the blobs, sent in one `submitStateTransition` transaction.',
    }),
    see: { label: msg`What the registry checks`, to: paths.learn('settlement') },
  },
  {
    id: 'threshold',
    term: msg`Threshold`,
    short: msg`How many committee members must cooperate to decrypt.`,
    text: msg({
      message:
        'How many committee members it takes to decrypt, `t` of `n`. The design trusts that no threshold of the committee colludes.',
    }),
  },
  {
    id: 'tracker-proof',
    term: msg`Tracker proof`,
    short: msg`A proof that your vote id is part of a state the registry accepted, which means your vote was recorded.`,
    text: msg`The path from a vote id’s leaf to a state root. When that root is one the registry held for the process, the vote was recorded as cast.`,
    see: { label: msg`Vote lookup`, to: paths.votes() },
  },
  {
    id: 'versioned-hash',
    term: msg`Versioned hash`,
    short: msg`What the chain keeps of a blob: a fingerprint the blob’s contents are checked against.`,
    text: msg({
      message:
        'What the chain keeps of a blob: `0x01` followed by the last 31 bytes of `sha256(commitment)`. The `BLOBHASH` opcode returns it, and the registry checks each blob against it.',
    }),
  },
  {
    id: 'vote-id',
    term: msg`Vote id`,
    short: msg`The number your voting app shows when you vote. Use it to find your vote and check it.`,
    text: msg`A 64-bit identifier of one ballot, at least 2^63, derived from a hash by the voter’s client. The voter signs it, the ballot proof takes it as a public input, and a settled transition inserts it in the state tree and publishes it in its blob.`,
    see: { label: msg`Vote lookup`, to: paths.votes() },
  },
  {
    id: 'voters-count',
    term: msg`Voters count`,
    short: msg`How many different people have voted so far. Someone who changes their vote is counted once.`,
    text: msg({
      message:
        'The distinct ballot slots written so far, `votersCount` on the registry. Overwrites are counted apart, in `overwrittenVotesCount`.',
    }),
  },
  {
    id: 'zkvm',
    term: msg`zkVM (ZisK)`,
    short: msg`A computer whose runs can be proven, so anyone can check a result without running the program again.`,
    text: msg`A virtual machine whose executions can be proven. DAVINCI’s guests are RISC-V programs proven with ZisK and wrapped in PLONK for the chain.`,
  },
] as const satisfies readonly GlossaryEntry[]

/** A glossary entry's anchor id. */
export type GlossaryId = (typeof GLOSSARY)[number]['id']

const BY_ID = new Map<string, GlossaryEntry>(GLOSSARY.map((e) => [e.id, e]))

/** The entry with this id. */
export function glossaryEntry(id: GlossaryId): GlossaryEntry {
  return BY_ID.get(id)!
}

/** The glossary page, scrolled to one entry. */
export function glossaryHref(id: GlossaryId): string {
  return `${paths.learn('glossary')}#term-${id}`
}

/** The glossary in the language `i18n` has active, sorted by term in that language. */
export function readGlossary(i18n: I18n, entries: readonly GlossaryEntry[] = GLOSSARY): GlossaryItem[] {
  return entries
    .map((e) => ({
      id: e.id,
      term: typeof e.term === 'string' ? e.term : i18n._(e.term),
      short: i18n._(e.short),
      text: i18n._(e.text),
      see: e.see ? { label: i18n._(e.see.label), to: e.see.to } : undefined,
    }))
    .sort((a, b) => a.term.localeCompare(b.term, i18n.locale, { sensitivity: 'base' }))
}

/** Items whose term or definitions contain every word of `query`, ignoring case and accents. */
export function filterGlossary<T extends { term: string; short?: string; text: string }>(
  query: string,
  items: T[]
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return items.filter((e) => {
    const hay = fold(`${e.term} ${e.short ?? ''} ${e.text}`)
    return words.every((w) => hay.includes(w))
  })
}

/** Lower case without accents, so `votacion` finds `votación`. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
