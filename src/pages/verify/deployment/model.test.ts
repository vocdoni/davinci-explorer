import { describe, expect, it } from 'vitest'
import { demoDeploymentDetails, DKG_CIRCUITS_V6_KEY_HASHES } from '~data/deployment'
import { demoFixture } from '~fixtures/demo'
import { KNOWN_RELEASES, matchRelease } from '~protocol/releases'
import { dkgStatus, releaseStatus, verifierStates, wiringStatus } from './model'

const release = KNOWN_RELEASES[0]!
const dkg = demoDeploymentDetails(demoFixture().store).dkg!

describe('releaseStatus', () => {
  it('passes when every pin matches, waits while unread, fails on a difference', () => {
    const pins = {
      batchProgramVK: release.batchProgramVK,
      resultsProgramVK: release.resultsProgramVK,
      rootCVadcopFinal: release.rootCVadcopFinal,
      ziskVerifierCodeHash: release.ziskVerifierCodeHash,
      ballotVKHash: release.ballotVKHash,
    }
    expect(releaseStatus(matchRelease(pins))).toBe('pass')
    expect(releaseStatus(matchRelease({ ...pins, ballotVKHash: null }))).toBe('pending')
    expect(releaseStatus(matchRelease({ ...pins, ballotVKHash: `0x${'00'.repeat(32)}` }))).toBe('fail')
  })
})

describe('wiringStatus', () => {
  it('combines the wiring checks', () => {
    expect(wiringStatus(['pass', 'pass'])).toBe('pass')
    expect(wiringStatus(['pass', 'unknown'])).toBe('pending')
    expect(wiringStatus(['fail', 'unknown'])).toBe('fail')
    expect(wiringStatus([])).toBe('pending')
  })
})

describe('dkgStatus', () => {
  it('checks each verifier against circuits-v6 and does not apply without an adapter', () => {
    expect(verifierStates(dkg).every((v) => v.state === 'pass')).toBe(true)
    expect(dkgStatus(true, dkg)).toBe('pass')
    expect(dkgStatus(false, null)).toBe('na')
    expect(dkgStatus(true, null)).toBe('pending')
    const other = {
      ...dkg,
      verifiers: dkg.verifiers.map((v, i) => (i === 0 ? { ...v, keyHash: DKG_CIRCUITS_V6_KEY_HASHES.finalize } : v)),
    }
    expect(dkgStatus(true, other)).toBe('fail')
  })
})
