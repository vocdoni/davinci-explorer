import { describe, expect, it } from 'vitest'
import { encodeFunctionData, type Hex } from 'viem'
import { processRegistryAbi } from '~contracts/abis'
import { txDetailsFrom } from './state'

const ZERO = `0x${'00'.repeat(20)}` as const

describe('txDetailsFrom', () => {
  it('reads the values a newProcess call created the election with', () => {
    const root = `0x${'1a'.repeat(32)}` as Hex
    const input = encodeFunctionData({
      abi: processRegistryAbi,
      functionName: 'newProcess',
      args: [
        0,
        1_790_665_190n,
        2_700n,
        12n,
        {
          uniqueValues: false,
          numFields: 5,
          groupSize: 5,
          costExponent: 1,
          maxValue: 50n,
          minValue: 0n,
          maxValueSum: 100n,
          minValueSum: 0n,
        },
        {
          censusOrigin: 2,
          censusRoot: root,
          contractAddress: ZERO,
          censusURI: 'https://census.example.org/v1.json',
          onchainAllowAnyValidRoot: false,
        },
        'https://metadata.example.org/p.json',
        `0x${'22'.repeat(32)}`,
        { x: 1n, y: 2n },
        { mode: 0, epochId: `0x${'00'.repeat(12)}`, orgPKx: 0n, orgPKy: 0n, popAx: 0n, popAy: 0n, popZ: 0n },
      ],
    })
    const d = txDetailsFrom(
      { hash: `0x${'ab'.repeat(32)}`, from: ZERO, to: ZERO, input, blockNumber: 1n },
      { status: 'success', gasUsed: 1n, effectiveGasPrice: 1n, blockNumber: 1n }
    )
    expect(d.functionName).toBe('newProcess')
    expect(d.decodeError).toBeNull()
    expect(d).toMatchObject({
      initialCensusRoot: root,
      initialCensusURI: 'https://census.example.org/v1.json',
      initialDuration: 2_700,
      initialMaxVoters: 12,
      initialStatus: 'ready',
    })
  })
})
