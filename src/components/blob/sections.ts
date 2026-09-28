import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { CellSection } from './cells'

/** Label and swatch of each blob section, shared by the layout bar and the cell view. Render the label with `i18n._`. */
export const SECTION_STYLE: Record<CellSection, { label: MessageDescriptor; swatch: string }> = {
  'vote-ids': { label: msg`Vote ids`, swatch: 'bg-series-1' },
  updates: { label: msg`Slot updates`, swatch: 'bg-series-3' },
  accumulator: { label: msg`Accumulator`, swatch: 'bg-amber' },
  padding: { label: msg`Zero padding`, swatch: 'bg-onyx' },
}
