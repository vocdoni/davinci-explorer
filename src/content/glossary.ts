// The glossary: every protocol word the explorer uses, with a plain definition
// (`short`, what `Term` shows on hover and what the glossary page shows first)
// and the full one (`text`, the mechanism and the exact names). Definitions are
// plain text with `backtick` code spans, so the page can filter them and a
// translation keeps the spans as they are. An expression goes in `formula`,
// never in the text: it is code, shown with `Formula` and never translated.
// `id` is the anchor (`/learn/glossary#term-<id>`): English in every language,
// and stable, since pages link to it. See docs/writing.md.

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
  /** The expression the full definition refers to, shown after it. Code, never translated. */
  formula?: string
  /** Where the explorer shows it. */
  see?: { label: MessageDescriptor; to: string }
}

/** A glossary entry in the active language. */
export interface GlossaryItem {
  id: string
  term: string
  short: string
  text: string
  formula?: string
  see?: { label: string; to: string }
}

const contracts = (section: string) => `${paths.contracts()}#${section}`

export const GLOSSARY = [
  {
    id: 'accumulator',
    term: msg`Encrypted total (accumulator)`,
    short: msg`The sum of every counted ballot, kept encrypted and updated by each batch. Only the final total is decrypted, to give the results.`,
    text: msg({
      message:
        'State leaf `0x04`: 16 ElGamal ciphertexts holding the encrypted sum of every counted ballot, one per ballot field. The encryption can be added up without being opened, so each batch updates the sum directly: it adds its new ballots, subtracts the ones they overwrite and adds the encryptions of zero of its silent refreshes. Only the final sum is decrypted by the protocol. The holder of the election key could decrypt any intermediate accumulator or ballot in the blobs.',
    }),
    see: { label: msg`How results are produced`, to: paths.learn('results') },
  },
  {
    id: 'application-id',
    term: msg`Application id (aid)`,
    short: msg`The number that registers an election with its key committee, so the committee decrypts only for that election.`,
    text: msg`The davinci-dkg application a DKG-mode process registers, computed as below from the chain id, the registry and the process id, and never zero (a zero result becomes 1). It scopes the committee’s decryptions to that process.`,
    formula: 'aid = keccak256(abi.encode(chainId, registry, processId)) mod Q',
  },
  {
    id: 'ballot',
    term: msg`Ballot`,
    short: msg`What a vote carries: the voter’s answers, encrypted on the voter’s device, one encrypted number per answer. Only the key holder could read it.`,
    text: msg({
      message:
        '16 ElGamal ciphertexts on the BabyJubJub curve, encrypted under the process key, one per field. Fields beyond the ballot mode’s `numFields` carry the identity, an empty value.',
    }),
  },
  {
    id: 'ballot-mode',
    term: msg`Ballot rules (ballot mode)`,
    short: msg`The rules every ballot must follow: how many answers, which values each may take and how much a voter may give in total.`,
    text: msg({
      message:
        'The shape of a valid ballot: how many fields (1 to 16), the minimum and maximum value of a field, the bounds on their sum, whether values must be unique, the group size and the cost exponent. Packed into state leaf `0x02`.',
    }),
    see: { label: msg`Processes`, to: paths.processes() },
  },
  {
    id: 'ballot-proof',
    term: msg`Ballot proof`,
    short: msg`A proof, made by the voting app, that the encrypted ballot follows the rules. It does not reveal what the ballot says.`,
    text: msg`A Groth16 proof, of the davinci-circom ballot circuit, that a ballot is a correct encryption for the process. Its public inputs are the voter’s address, the vote id and an inputs hash over the process id, the ballot mode, the key, the voter’s address, the vote id, the ciphertexts and the weight.`,
  },
  {
    id: 'ballot-vk-hash',
    term: msg`Ballot VK hash`,
    short: msg`The fingerprint of the key that checks ballot proofs. The registry fixes it, so every election checks ballots the same way.`,
    text: msg({
      message:
        'sha256 of the ballot proof’s verification key: a registry immutable, written into every genesis state as leaf `0x07`. The guest hashes the key it is given and only accepts ballot proofs under a key with this hash.',
    }),
    see: { label: msg`Pinned values`, to: contracts('parameters') },
  },
  {
    id: 'batch',
    term: msg`Batch`,
    short: msg`A group of votes a sequencer proves and records on the chain together, in one transaction.`,
    text: msg`The votes a sequencer proves together as one state transition: up to 1024, at most one per ballot slot.`,
  },
  {
    id: 'blob',
    term: msg`Data blob`,
    short: msg`Data published along with a transaction. Each batch publishes its votes in data blobs so anyone can check what was counted; the network deletes them after about two weeks.`,
    text: msg`An EIP-4844 data blob: 4096 cells of 32 bytes carried next to a transaction. A transition’s blobs publish its vote ids, the slots it wrote and the new encrypted tally. Beacon nodes prune them after about 15 days on Gnosis Chain (16384 epochs of 80 s) and about 18 on Ethereum mainnet.`,
    see: { label: msg`The published data (blobs)`, to: paths.learn('blobs') },
  },
  {
    id: 'blob-digest',
    term: msg`Blob digest`,
    short: msg`One fingerprint of all the data a batch published. The proof includes it, which ties the published data to the proof.`,
    text: msg({
      message:
        'A SHA-256 hash over a transition’s blob commitments and evaluations, as below, where each `y` is the blob’s value at its bound point. The guest publishes it in registers 28 to 35; the registry recomputes it from the transaction.',
    }),
    formula: 'sha256(commitment₀ ‖ y₀ ‖ commitment₁ ‖ y₁ ‖ …)',
  },
  {
    id: 'census',
    term: msg`List of voters (census)`,
    short: msg`Who may vote in an election, and with what weight.`,
    text: msg`Who may vote and with what weight: a Merkle tree (fixed, updatable by the organizer, or kept by a contract) or the signatures of a credential service provider.`,
    see: { label: msg`Who may vote (census)`, to: paths.learn('census') },
  },
  {
    id: 'census-origin',
    term: msg`Kind of list (census origin)`,
    short: msg`Where an election’s list of voters comes from: a fixed list, a list the organizer can update, a contract, or a credential service.`,
    text: msg({
      message:
        'Which kind of census a process uses: 1 fixed Merkle tree, 2 updatable Merkle tree, 3 on-chain census contract, 4 credential service provider. Chosen at creation, stored in state leaf `0x06`.',
    }),
  },
  {
    id: 'census-root',
    term: msg`Census root`,
    short: msg`A fingerprint of the list of voters. Every vote in a batch is checked against the list it stands for.`,
    text: msg`What a batch’s census proofs lead to: the lean-IMT root of a Merkle census, or the CSP signer’s address. The guest publishes it and the registry compares it with the roots the process accepts.`,
  },
  {
    id: 'chaum-pedersen-proof',
    term: msg`Chaum–Pedersen proof`,
    short: msg`A proof that a number is the correct decryption of an encrypted value. It does not reveal the secret key.`,
    text: msg`A proof that a value is the correct decryption of a ciphertext under a public key, without revealing the secret. The results guest checks 16 of them; each DKG partial decryption proves the same relation for one member’s share.`,
  },
  {
    id: 'committee',
    term: msg`Key committee`,
    short: msg`A group of independent operators who hold an election key together, in shares. Enough of them must cooperate to decrypt; fewer cannot.`,
    text: msg`The davinci-dkg operators of one epoch, drawn by an on-chain lottery. A threshold of them can decrypt under the epoch’s pool keys; fewer cannot.`,
    see: { label: msg`The key committee`, to: contracts('dkg') },
  },
  {
    id: 'csp',
    term: msg`CSP (credential service provider)`,
    short: msg`A service that signs each voter’s credential. Its signature is what lets a voter vote.`,
    text: msg`Census origin 4: an authority that signs each voter’s credential with an ECDSA (secp256k1) key. Its address is the census root; the signed index sets the voter’s slot.`,
  },
  {
    id: 'dkg',
    term: msg`DKG`,
    short: msg`Distributed key generation: a group creates a key together, so that no single member ever knows the whole secret.`,
    text: msg`Distributed key generation. davinci-dkg’s committee jointly generates keys no single member knows and decrypts under them on demand, each step proven with Groth16 on chain.`,
  },
  {
    id: 'encryption-key',
    term: msg`Election key (encryption key)`,
    short: msg`The key voters encrypt their ballots to. Whoever holds the matching secret, the key holder, could read them.`,
    text: msg({
      message:
        'A point on the BabyJubJub curve, fixed at creation and pinned in the genesis state as leaf `0x03`. Voters encrypt every ballot field to it with ElGamal, each batch re-encrypts the stored ballots under it, and the final tally is decrypted with its secret. Who holds that secret depends on the key mode.',
    }),
    see: { label: msg`Who holds the key (key modes)`, to: paths.learn('key-modes') },
  },
  {
    id: 'epoch',
    term: msg`Epoch`,
    short: msg`One round of the key committee: its members are drawn and create a new set of keys.`,
    text: msg`One DKG run: a committee is drawn and deals 16 pool keys; once finalized the epoch is Live and applications can claim keys. Epochs are created at a fixed cadence, or early when the newest pool is nearly spent or the epoch aborted.`,
    see: { label: msg`The key committee`, to: contracts('dkg') },
  },
  {
    id: 'fail-mask',
    term: msg`Fail mask`,
    short: msg`A number the proof makes public that says which checks failed. Zero means every check passed.`,
    text: msg`Register 1 of the public values: one bit per kind of check the guest failed. The registry accepts a proof only with the values below.`,
    formula: 'ok = 1, fail_mask = 0',
  },
  {
    id: 'fingerprint',
    term: msg`Fingerprint (hash)`,
    short: msg`A short code computed from some data. Change the data even slightly and the fingerprint changes completely, so matching fingerprints mean the data is the same.`,
    text: msg`What the explorer calls a hash, a digest or a root: the output of a hash function such as SHA-256 or keccak256 over some bytes. A Merkle root is the fingerprint of a whole tree of values. Comparing a fingerprint the chain recorded with one you compute yourself is how you check data without trusting whoever served it.`,
  },
  {
    id: 'genesis-root',
    term: msg`Genesis root`,
    short: msg`The fingerprint of an election’s state before any vote. The registry computes it itself when the election is created.`,
    text: msg`The state root before the first transition, computed by the registry at creation from six leaves: the process id, the ballot mode, the encryption key hash, an empty accumulator, the census origin and the ballot VK hash.`,
  },
  {
    id: 'grace-window',
    term: msg`Grace window`,
    short: msg`A short time after an election’s end during which batches of votes cast before the end can still be recorded. The results wait until it closes.`,
    text: msg({
      message:
        'Sequencers collect votes and record them in batches, so a vote cast just before the end can still be on its way when the end passes. The registry keeps accepting batches after the end until the grace window closes, `getProcessGraceEnd`, as below: `grace` seconds after the end or after the last batch, whichever is later, and never more than `graceMaxTotal` after the end. `lastVoteAt` is the time of the last recorded batch. Every batch recorded after the end moves the window later, and once it closes nothing is recorded again. The results calls revert with `GraceOpen` until then. The registry cannot tell when a vote was cast, so a sequencer could include one cast after the end; the window is short and capped, and each batch’s time is public.',
    }),
    formula: 'graceEnd = min(end + graceMaxTotal, max(end, lastVoteAt) + grace)',
    see: { label: msg`What the chain checks for each batch`, to: `${paths.learn('settlement')}#after-the-end` },
  },
  {
    id: 'guest',
    term: msg`Program (guest)`,
    short: msg`A program whose run is proven. The batch program checks each batch of votes; the results program checks the results.`,
    text: msg`A program the zkVM proves. The vote-batch guest proves a transition; the results guest proves a sequencer-key tally.`,
  },
  {
    id: 'key-mode',
    term: msg`Key holder (key mode)`,
    short: msg`Who holds the key the ballots are encrypted to, and so who can decrypt the results.`,
    text: msg`Who holds the key the ballots are encrypted under: one sequencer, a davinci-dkg committee (automatic), or the committee plus an organizer secret (locked).`,
    see: { label: msg`Who holds the key (key modes)`, to: paths.learn('key-modes') },
  },
  {
    id: 'kzg-commitment',
    term: msg`KZG commitment`,
    short: msg`A short fingerprint of a data blob, which lets the chain check what the blob contains.`,
    text: msg`A 48-byte commitment to a blob’s polynomial. The versioned hash is derived from it, and the point-evaluation precompile checks an opening of the blob against it.`,
  },
  {
    id: 'merkle-tree',
    term: msg`Merkle tree`,
    short: msg`A way to take one fingerprint of a long list, so that anyone can show an item is on the list with a short proof.`,
    text: msg`A tree of hashes: each leaf stands for one item, each node is the hash of its two children, up to one root. An inclusion proof is the path of sibling hashes from a leaf to the root. A process’s state tree is a SHA-256 sparse Merkle tree of 64 levels, each leaf the hash of its key and value (below). A Merkle census is a lean-IMT tree hashed with Poseidon whose leaves are not hashed: each is the voter’s address and weight packed into one number.`,
    formula: 'leaf = sha256(le64(key) ‖ le256(value) ‖ 0x01)',
  },
  {
    id: 'metadata-hash',
    term: msg`Metadata hash`,
    short: msg`The fingerprint of the election’s description document (title, question, options), recorded on the chain so any change to it shows.`,
    text: msg({
      message:
        'The SHA-256 of the exact bytes of a process’s metadata document, the file with its title, question and option names. The registry stores it as `metadataHash` beside the document’s address, so anyone can download the document and compare: one changed byte, even a space, gives another hash. The organizer can publish a new version until the end; each one is a `ProcessMetadataUpdated` event.',
    }),
    see: { label: msg`How a process is created`, to: `${paths.learn('how-it-works')}#1-a-process-is-created` },
  },
  {
    id: 'observer',
    term: msg`Observer`,
    short: msg`A sequencer that follows and re-checks every election but never records batches itself.`,
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
    short: msg`The account that created an election. Only it can pause, extend or cancel it.`,
    text: msg`The account that created a process. Only it can change the process’s status, extend its duration, change its voter limit, publish a new version of its metadata document before the end or, for an updatable census, replace the census.`,
  },
  {
    id: 'organizer-secret',
    term: msg`Organizer secret`,
    short: msg`In the organizer-locked key mode, the organizer’s part of the key. The results cannot be decrypted until it is revealed.`,
    text: msg`In the organizer-locked committee mode (DKG locked), the organizer’s half of the process key. The committee cannot decrypt until it is revealed, and losing it loses the results.`,
  },
  {
    id: 'overwrite',
    term: msg`Changed vote (overwrite)`,
    short: msg`A new vote from someone who had already voted. It replaces their previous vote, and only the newer one counts.`,
    text: msg`A vote for a slot that already holds a ballot. The new ballot replaces the old one in the tally. The blob does not show which occupied slot it was: an overwrite and a silent refresh look the same.`,
    see: { label: msg`Changing your vote, privately`, to: paths.learn('silent-revoting') },
  },
  {
    id: 'plonk-proof',
    term: msg`PLONK proof`,
    short: msg`The small proof the registry checks on the chain before it records a batch of votes or the results.`,
    text: msg`The succinct proof the registry verifies: a guest’s ZisK proof, wrapped. 768 bytes of proof and 512 bytes of public values at every batch size.`,
  },
  {
    id: 'pool-key',
    term: msg`Pool key`,
    short: msg`One of the keys a key committee creates in each round. Each election whose key the committee holds uses one.`,
    text: msg`One of the 16 keys an epoch’s committee deals. Each application, and so each DKG-mode process, claims one.`,
  },
  {
    id: 'process',
    term: msg`Process`,
    short: msg`The registry’s record of one election, from its rules to its results. The explorer lists elections as processes.`,
    text: msg`One election on the registry: its parameters, census, key and state root while it runs, and its results at the end.`,
    see: { label: msg`Processes`, to: paths.processes() },
  },
  {
    id: 'process-id',
    term: msg`Process id`,
    short: msg`An election’s unique number, built from the organizer’s address, the registry and a counter.`,
    text: msg({
      message:
        'A `bytes31`: the organizer’s address (20 bytes), the registry’s 4-byte prefix and a 7-byte per-organizer nonce. An id from another registry or chain is refused.',
    }),
    see: { label: msg`Processes`, to: paths.processes() },
  },
  {
    id: 'program-vk',
    term: msg`Program vk`,
    short: msg`The fingerprint of a proven program. The registry only accepts proofs made by the program with this fingerprint.`,
    text: msg({
      message:
        'The verification key of a guest program: what `cargo-zisk setup` prints as its root hash. The registry pins one for the vote-batch guest and one for the results guest, and every proof is checked against its program’s.',
    }),
    see: { label: msg`Pinned values`, to: contracts('parameters') },
  },
  {
    id: 'proof',
    term: msg`Proof`,
    short: msg`Data that shows a computation was done correctly. Anyone can check it quickly, without redoing the computation.`,
    text: msg`DAVINCI uses three kinds: the Groth16 ballot proof a voting app makes, which also keeps the ballot secret; the zkVM proof of a guest program, wrapped into the PLONK proof the registry verifies; and the Groth16 proofs of each step of the DKG committee.`,
  },
  {
    id: 'public-values',
    term: msg`Public values (publics)`,
    short: msg`What a proof makes public: the state before and after a batch, the counts, and whether every check passed.`,
    text: msg`The guest’s 64 output registers, each as an 8-byte little-endian word: 512 bytes holding the roots, counts, census root, blob digest and verdict. The verifier binds the proof to them.`,
  },
  {
    id: 're-encryption',
    term: msg`Re-encryption`,
    short: msg`Changing how an encrypted ballot looks without changing what it says, so nobody can link it to the ballot that was sent.`,
    text: msg`Adding an encryption of zero with a fresh scalar to a ciphertext: the same plaintext, a new ciphertext. Every stored ballot is re-encrypted with scalars derived from the batch’s secret seed. Without the seed nobody can match a sent ballot to the stored one; it does not hide whose slot it is.`,
    see: { label: msg`Changing your vote, privately`, to: paths.learn('silent-revoting') },
  },
  {
    id: 'registry',
    term: msg`Registry (ProcessRegistry)`,
    short: msg`The contract that holds every election of a deployment. It records a batch of votes or the results only with a valid proof.`,
    text: msg({
      message:
        'The `ProcessRegistry` contract. It creates processes and assigns their ids, keeps each process’s latest state root and counters, runs every check of `submitStateTransition` before a batch settles, and stores the results, from `setProcessResults` or from the DKG. Its program vks and setup root are fixed at deployment.',
    }),
    see: { label: msg`Contracts`, to: paths.contracts() },
  },
  {
    id: 'root-c-vadcop-final',
    term: 'rootCVadcopFinal',
    short: msg`The fingerprint of the proving setup every proof is made with. The registry fixes it.`,
    text: msg`The root of the ZisK vadcop-final setup the proofs are wrapped with, pinned by the registry next to the program vks. It changes with the ZisK setup, not with the guests.`,
    see: { label: msg`Pinned values`, to: contracts('parameters') },
  },
  {
    id: 'sequencer',
    term: msg`Sequencer`,
    short: msg`A node that collects votes, proves them in batches and records them on the chain. Anyone can run one.`,
    text: msg`A node that collects ballots, proves them in batches and settles them on the registry. Settlement is permissionless, so any number can serve a process.`,
    see: { label: msg`Sequencers`, to: paths.sequencers() },
  },
  {
    id: 'settlement',
    term: msg`Recording a batch (settlement)`,
    short: msg`Recording a batch of votes on the chain. The registry checks the batch’s proof and, if it holds, moves the election to its new state.`,
    text: msg({
      message:
        'A sequencer settles a batch by sending `submitStateTransition` with the proof, the public values and the blobs. Settlement is permissionless: anyone may send it, and the registry’s checks decide whether it lands. A settled batch is a state transition.',
    }),
    see: { label: msg`What the chain checks for each batch`, to: paths.learn('settlement') },
  },
  {
    id: 'silent-refresh',
    term: msg`Silent refresh`,
    short: msg`A fresh encryption of a stored ballot that did not change. Batches add them so that a changed vote cannot be told apart.`,
    text: msg`A re-encryption of an occupied slot the batch did not write. Every batch carries enough of them that an overwrite looks like routine noise. A slot’s first write stays public, since refreshes only touch occupied slots.`,
    see: { label: msg`Changing your vote, privately`, to: paths.learn('silent-revoting') },
  },
  {
    id: 'slot',
    term: msg`Slot`,
    short: msg`The place in an election’s state where one voter’s ballot is kept. A new vote from the same voter replaces what is there.`,
    text: msg({
      message:
        'The key of a voter’s ballot in the state tree, in the range below: derived from the voter’s address for a Merkle census, `0x10` plus the signed index for a CSP.',
    }),
    formula: '0x10 ≤ slot < 2^63',
    see: { label: msg`Ballot slots`, to: `${paths.learn('census')}#ballot-slots` },
  },
  {
    id: 'state-root',
    term: msg`State root`,
    short: msg`A fingerprint of an election’s whole state: every vote id, every ballot and the encrypted total.`,
    text: msg`The root of a process’s state tree, a SHA-256 sparse Merkle tree of 64 levels holding the process configuration, every vote id, every ballot and the encrypted tally. The registry keeps the latest one; each transition moves it.`,
  },
  {
    id: 'state-transition',
    term: msg`State transition`,
    short: msg`One recorded batch of votes. It moves the election’s state from one fingerprint to the next.`,
    text: msg({
      message:
        'One settled batch: the root before, the root after, the proof and the blobs, sent in one `submitStateTransition` transaction.',
    }),
    see: { label: msg`What the chain checks for each batch`, to: paths.learn('settlement') },
  },
  {
    id: 'threshold',
    term: msg`Threshold`,
    short: msg`How many committee members must cooperate to decrypt.`,
    text: msg({
      message:
        'How many committee members it takes to decrypt: `t` of the committee’s `n`. The design trusts that no threshold of the committee colludes.',
    }),
  },
  {
    id: 'tracker-proof',
    term: msg`Receipt (tracker proof)`,
    short: msg`A sequencer’s proof that your vote id is part of a state the registry recorded, which means your vote was recorded.`,
    text: msg`The path from a vote id’s leaf to a state root. When that root is one the registry held for the process, the vote was recorded as cast.`,
    see: { label: msg`Check your vote`, to: paths.votes() },
  },
  {
    id: 'versioned-hash',
    term: msg`Versioned hash`,
    short: msg`What the chain keeps of a blob: a fingerprint the blob’s contents are checked against.`,
    text: msg({
      message:
        'What the chain keeps of a blob: the version byte `0x01` followed by the last 31 bytes of the SHA-256 of its commitment, as below. The `BLOBHASH` opcode returns it, and the registry checks each blob against it.',
    }),
    formula: '0x01 ‖ sha256(commitment)[1..]',
  },
  {
    id: 'vote-id',
    term: msg`Vote id`,
    short: msg`The number your voting app shows when you vote. Use it to find your vote and check it.`,
    text: msg({
      message:
        'A 64-bit identifier of one ballot, at least 2⁶³. The voting app computes it, as below, from the process, the voter’s address and the ballot’s secret randomness `k`, so a new ballot gets a new vote id. The voter signs it, the ballot proof takes it as a public input, and a settled transition inserts it in the state tree and publishes it in its blob.',
    }),
    formula: 'voteId = 2^63 + (Poseidon(processId, address, k) mod 2^63)',
    see: { label: msg`Check your vote`, to: paths.votes() },
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
      formula: e.formula,
      see: e.see ? { label: i18n._(e.see.label), to: e.see.to } : undefined,
    }))
    .sort((a, b) => a.term.localeCompare(b.term, i18n.locale, { sensitivity: 'base' }))
}

/** Items whose term, definitions or formula contain every word of `query`, ignoring case and accents. */
export function filterGlossary<T extends { term: string; short?: string; text: string; formula?: string }>(
  query: string,
  items: T[]
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return items.filter((e) => {
    const hay = fold(`${e.term} ${e.short ?? ''} ${e.text} ${e.formula ?? ''}`)
    return words.every((w) => hay.includes(w))
  })
}

/** Lower case without accents, so `votacion` finds `votación`. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
