import { describe, expect, it } from 'vitest'
import { metadataStatus, readServedDocument, sameHash } from './metadata'

const bytes = (s: string) => new TextEncoder().encode(s)

// Hashes from coreutils: printf '<bytes>' | sha256sum
const COMPACT = '0x27503c8b55d6cdd9256053d7f84ead30d502467a1ed11f64071aa34c3a1d0e25'
const TRAILING_SPACE = '0x0d86d9302c07f62b291161295ba5201316b4931d84890556a2b1549c3139b568'
const TRAILING_NEWLINE = '0x81e67f03c3a49df35aa0d088dce7d0e2817f0b71c6a8305aeacb9b9be37483aa'
const SPACED = '0xa85e44f9f03760dcfef3d1ce46f63635c0a3ecfb7b0a6325643138c134383bbf'
const WITH_BOM = '0x6b5e64c9f4482aed0e546593281785f40bcac718364c1411f48d61d09ed3af0c'
const EMPTY = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

describe('readServedDocument', () => {
  it('hashes the exact bytes and parses the JSON from them', () => {
    const served = readServedDocument(bytes('{"title":"x"}'))
    expect(served).toEqual({ hash: COMPACT, size: 13, doc: { title: 'x' }, parseError: null })
  })

  it('gives the same JSON another hash when a single byte differs', () => {
    const variants: Array<[string, string]> = [
      ['{"title":"x"} ', TRAILING_SPACE],
      ['{"title":"x"}\n', TRAILING_NEWLINE],
      ['{ "title": "x" }', SPACED],
      ['\uFEFF{"title":"x"}', WITH_BOM],
    ]
    for (const [text, hash] of variants) {
      const served = readServedDocument(bytes(text))
      expect(served.hash).toBe(hash)
      expect(served.doc).toEqual({ title: 'x' })
      expect(metadataStatus({ fetchable: true, committed: COMPACT, served, failed: false })).toBe('differs')
    }
  })

  it('still hashes bytes that are not JSON', () => {
    expect(readServedDocument(new Uint8Array())).toMatchObject({ hash: EMPTY, size: 0, doc: undefined })
    const html = readServedDocument(bytes('<html>not found</html>'))
    expect(html.doc).toBeUndefined()
    expect(html.parseError).toBeTruthy()
    // Not UTF-8.
    expect(readServedDocument(Uint8Array.from([0x7b, 0xff, 0x7d])).parseError).toBeTruthy()
  })
})

describe('metadataStatus', () => {
  const served = readServedDocument(bytes('{"title":"x"}'))
  it('matches the committed hash whatever its hex case', () => {
    expect(sameHash(COMPACT.toUpperCase().replace('0X', '0x'), COMPACT)).toBe(true)
    expect(metadataStatus({ fetchable: true, committed: COMPACT.toUpperCase(), served, failed: false })).toBe('matches')
  })

  it('waits, gives up or does not try', () => {
    expect(metadataStatus({ fetchable: true, committed: null, served, failed: false })).toBe('loading')
    expect(metadataStatus({ fetchable: true, committed: COMPACT, served: null, failed: false })).toBe('loading')
    expect(metadataStatus({ fetchable: true, committed: COMPACT, served: null, failed: true })).toBe('unreachable')
    expect(metadataStatus({ fetchable: false, committed: COMPACT, served: null, failed: false })).toBe('not-browsable')
  })
})
