// The election presets of davinci-sdk and the ballot modes they resolve to,
// as `resolveElectionPreset` builds them (src/core/types/ballot.ts in
// https://github.com/vocdoni/davinci-sdk), plus the SDK's budget recipe,
// which has no preset. The demo processes use them and the ballot-mode tests
// read each one back. groupSize is numFields, as the SDK sets it.

import type { BallotMode } from '~indexer/types'

export type ElectionPreset =
  | { type: 'single_choice'; allowAbstain?: boolean }
  | { type: 'multiple_choice'; maxSelections: number; minSelections?: number }
  | { type: 'approval' }
  | { type: 'rating'; maxValue: number; minValue?: number }
  | { type: 'ranking' }
  | { type: 'quadratic'; budget: number; minValueSum?: number }

/** Points spread linearly under a budget, capped per option (the davinci-sdk ballot-modes reference). */
export interface BudgetRecipe {
  type: 'budget'
  maxPerOption: number
  budget: number
}

export type DemoBallot = ElectionPreset | BudgetRecipe

function mode(
  numFields: number,
  minValue: number,
  maxValue: number,
  uniqueValues: boolean,
  costExponent: number,
  minValueSum: number,
  maxValueSum: number
): BallotMode {
  return {
    uniqueValues,
    numFields,
    groupSize: numFields,
    costExponent,
    maxValue: BigInt(maxValue),
    minValue: BigInt(minValue),
    maxValueSum: BigInt(maxValueSum),
    minValueSum: BigInt(minValueSum),
  }
}

/** The ballot mode the SDK resolves a preset to, for a question with `numFields` choices. */
export function presetBallotMode(preset: ElectionPreset, numFields: number): BallotMode {
  switch (preset.type) {
    case 'single_choice':
      return mode(numFields, 0, 1, false, 1, preset.allowAbstain ? 0 : 1, 1)
    case 'multiple_choice':
      return mode(numFields, 0, 1, false, 1, preset.minSelections ?? 0, preset.maxSelections)
    case 'approval':
      return mode(numFields, 0, 1, false, 1, 0, numFields)
    case 'rating': {
      const min = preset.minValue ?? 0
      return mode(numFields, min, preset.maxValue, false, 1, numFields * min, numFields * preset.maxValue)
    }
    case 'ranking': {
      const sum = (numFields * (numFields + 1)) / 2
      return mode(numFields, 1, numFields, true, 1, sum, sum)
    }
    case 'quadratic':
      return mode(numFields, 0, preset.budget, false, 2, preset.minValueSum ?? 0, preset.budget)
  }
}

export function demoBallotMode(ballot: DemoBallot, numFields: number): BallotMode {
  return ballot.type === 'budget'
    ? mode(numFields, 0, ballot.maxPerOption, false, 1, 0, ballot.budget)
    : presetBallotMode(ballot, numFields)
}
