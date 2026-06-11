import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Graph from './Graph'

vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series, xAxis }) => (
    <div
      data-testid="line-chart"
      data-series={series.map((item) => item.id).join(',')}
      data-points={xAxis[0].data.join(',')}
      data-net={series.find((item) => item.id === 'net')?.data.join(',') || ''}
    />
  ),
}))

const statisticsRange = { startDate: '2026-06-01', endDate: '2026-06-30' }

describe('Graph', () => {
  it('shows an empty-state message when there is no data for the selected range', () => {
    render(<Graph entries={[]} statisticsRange={statisticsRange} />)

    expect(screen.getByText('No statistics data is available for the selected range.')).toBeInTheDocument()
  })

  it('renders the expected default series and allows toggling them off', async () => {
    const user = userEvent.setup()
    const entries = [
      { id: '1', type: 'deposit', amount: 1000, date: '2026-06-01', isDue: false },
      { id: '2', type: 'salesTax', amount: 500, date: '2026-06-01' },
      { id: '3', type: 'withdrawal', amount: 250, date: '2026-06-02' },
      { id: '4', type: 'deposit', amount: 400, date: '2026-06-02', isDue: true },
    ]

    render(<Graph entries={entries} statisticsRange={statisticsRange} />)

    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-series', 'deposit,salesTax,withdrawal,net')
    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-net', '1500,1650')

    await user.click(screen.getByRole('checkbox', { name: 'Deposits' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sales Tax' }))
    await user.click(screen.getByRole('checkbox', { name: 'Withdrawals' }))
    await user.click(screen.getByRole('checkbox', { name: 'Net Total' }))

    expect(screen.getByText('Select at least one line type to display the graph.')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Dues' }))
    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-series', 'dues')
  })
})