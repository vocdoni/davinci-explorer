// Plain sentences the Verify flows share. `msg` descriptors: render them with
// `i18n._` while rendering.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { KeyModeName } from '~protocol/types'

/** Who could open a ballot of an election, by key mode. */
export const WHO_CAN_DECRYPT: Record<KeyModeName, MessageDescriptor> = {
  sequencer: msg`One sequencer holds the election key. It could open any single ballot, and it alone can publish the results, with a proof that they are right.`,
  'dkg-automatic': msg`A key committee holds the election key in shares, and nobody has the whole key: not a sequencer, not the organizer. Opening a ballot would take a threshold of committee members acting together; they only ever decrypt the final total.`,
  'dkg-locked': msg`A key committee holds the election key in shares, locked with a secret the organizer keeps (the organizer secret). Nothing can be decrypted until the organizer reveals it, and the committee only ever decrypts the final total. Opening a single ballot would take a threshold of its members acting together, and, before the reveal, the organizer secret too.`,
}

/** How the results are produced, by key mode. */
export const HOW_RESULT: Record<KeyModeName, MessageDescriptor> = {
  sequencer: msg`After the vote ends, the key holder decrypts the encrypted total and proves, with the published results program, that the numbers it publishes are that decryption. The registry checks the proof before it stores them.`,
  'dkg-automatic': msg`After the vote ends, the encrypted total goes to the key committee. A threshold of members decrypt it, each with a proof the committee’s contracts check, and the registry stores the numbers they agree on.`,
  'dkg-locked': msg`After the vote ends, the encrypted total goes to the key committee, which can decrypt it once the organizer reveals the organizer secret. Each member’s part comes with a proof the committee’s contracts check, and the registry stores the numbers they agree on.`,
}
