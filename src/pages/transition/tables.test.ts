import { i18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { BATCH_FAIL_BITS, BATCH_REGISTERS } from '~protocol/publics'
import { CHECK_ORDER, checkCopy, ONCHAIN_LABELS } from './checks'
import { FAIL_BIT_MEANINGS, READ_BY_LABEL, REGISTER_CHECK, REGISTER_NOTES } from './meaning'

describe('the page tables', () => {
  it('explain every fail bit of the shared table, in its order', () => {
    expect(FAIL_BIT_MEANINGS.map((b) => b.bit)).toEqual(BATCH_FAIL_BITS.map((b) => b.bit))
    for (const b of FAIL_BIT_MEANINGS) {
      expect(b.constant).toMatch(/^FAIL_[A-Z_]+$/)
      expect(i18n._(b.meaning)).toMatch(/^[A-Z].+\.$/)
    }
  })

  it('note and check only registers the guest writes', () => {
    const starts = new Set(BATCH_REGISTERS.map((r) => r.index))
    for (const index of [...Object.keys(REGISTER_NOTES), ...Object.keys(REGISTER_CHECK)].map(Number)) {
      expect(starts.has(index)).toBe(true)
    }
    for (const id of Object.values(REGISTER_CHECK)) expect(CHECK_ORDER).toContain(id)
    expect(i18n._(REGISTER_NOTES[42]!)).toMatch(/pins this one to its own count/)
  })

  it('name every reader of a register', () => {
    const readers = new Set(BATCH_REGISTERS.flatMap((r) => r.readBy))
    for (const who of readers) {
      expect(i18n._(READ_BY_LABEL[who].label)).not.toBe('')
      expect(i18n._(READ_BY_LABEL[who].hint)).not.toBe('')
    }
    expect(i18n._(READ_BY_LABEL.contract.label)).toBe('Registry')
  })
})

describe('checkCopy', () => {
  it('says what the registry enforced and how to recheck it, for every check', () => {
    for (const id of CHECK_ORDER) {
      const copy = checkCopy(id, 'merkle-static')
      expect(i18n._(copy.meaning).length).toBeGreaterThan(40)
      expect(i18n._(copy.enforced).length).toBeGreaterThan(40)
      expect(i18n._(copy.recheck).length).toBeGreaterThan(20)
      // Expressions live in the formula fields, never in the translated text.
      for (const text of [copy.meaning, copy.enforced, copy.recheck].map((d) => i18n._(d))) {
        expect(text).not.toMatch(/\|\||‖|sha256\(/)
      }
    }
    expect(checkCopy('blobs-digest', null).formula).toContain('sha256(')
    expect(i18n._(ONCHAIN_LABELS.plonk)).toBe('The proof itself is valid')
  })

  it('asks the census contract for an on-chain census', () => {
    expect(i18n._(checkCopy('census-root', 'onchain-dynamic').enforced)).toMatch(/getRootBlockNumber/)
    expect(i18n._(checkCopy('census-root', 'merkle-static').enforced)).toMatch(/big-endian integer/)
  })
})
