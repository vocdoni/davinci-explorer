import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { demoFixture } from '~fixtures/demo'
import { paths, patterns } from '~routes/paths'
import { renderWithProviders } from '../../test-utils'
import { ProcessesPage } from '.'

const fixture = demoFixture()

describe('ProcessesPage', () => {
  it('gives a canceled election no end time', () => {
    renderWithProviders(
      <Routes>
        <Route path={patterns.processes} element={<ProcessesPage />} />
      </Routes>,
      { route: paths.processes({ status: 'canceled' }) }
    )
    const canceled = fixture.store.processOrder.filter((k) => fixture.store.processes[k]!.state?.status === 'canceled')
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(canceled.length)
    for (const row of rows) expect(within(row).getAllByRole('cell').at(-1)).toHaveTextContent(/^—$/)
  })
})
