import { useMemo, useState } from 'react'
import { PieChart } from '@mui/x-charts/PieChart'
import { Box, Button, ButtonGroup, Stack, Typography } from '@mui/material'

const chartModes = [
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
]

const depositSegments = [
  { id: 'dues', label: 'Dues', color: '#00897b' },
  { id: 'donations', label: 'Donations', color: '#00acc1' },
  { id: 'salesTax', label: 'Sales Tax', color: '#3949ab' },
  { id: 'other', label: 'Other', color: '#78909c' },
]

const withdrawalSegments = [
  { id: 'traderBid', label: 'Guild Trader', color: '#c62828' },
  { id: 'heraldry', label: 'Heraldry', color: '#ef5350' },
  { id: 'other', label: 'Other', color: '#8d6e63' },
]

function PieBreakdownChart({ entries, statisticsRange }) {
  const [mode, setMode] = useState('deposits')

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.date >= statisticsRange.startDate && entry.date <= statisticsRange.endDate,
      ),
    [entries, statisticsRange.endDate, statisticsRange.startDate],
  )

  const chartData = useMemo(() => {
    if (mode === 'deposits') {
      const totals = {
        dues: 0,
        donations: 0,
        salesTax: 0,
        other: 0,
      }

      filteredEntries.forEach((entry) => {
        if (entry.type === 'salesTax') {
          totals.salesTax += entry.amount
          return
        }

        if (entry.type !== 'deposit') {
          return
        }

        if (entry.isDue) {
          totals.dues += entry.amount
          return
        }

        if (entry.isDonation) {
          totals.donations += entry.amount
          return
        }

        totals.other += entry.amount
      })

      return depositSegments
        .map((segment) => ({
          ...segment,
          value: totals[segment.id],
        }))
        .filter((segment) => segment.value > 0)
    }

    const totals = {
      traderBid: 0,
      heraldry: 0,
      other: 0,
    }

    filteredEntries.forEach((entry) => {
      if (entry.type !== 'withdrawal') {
        return
      }

      if (entry.withdrawalCategory === 'traderBid') {
        totals.traderBid += entry.amount
        return
      }

      if (entry.withdrawalCategory === 'heraldry') {
        totals.heraldry += entry.amount
        return
      }

      totals.other += entry.amount
    })

    return withdrawalSegments
      .map((segment) => ({
        ...segment,
        value: totals[segment.id],
      }))
      .filter((segment) => segment.value > 0)
  }, [filteredEntries, mode])

  const totalValue = chartData.reduce((sum, segment) => sum + segment.value, 0)

  if (filteredEntries.length === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No statistics data is available for the selected range.
        </Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <ButtonGroup variant="outlined" size="small">
          {chartModes.map((chartMode) => (
            <Button
              key={chartMode.value}
              variant={mode === chartMode.value ? 'contained' : 'outlined'}
              onClick={() => setMode(chartMode.value)}
            >
              {chartMode.label}
            </Button>
          ))}
        </ButtonGroup>
        <Typography variant="body2" color="text.secondary">
          Total: {totalValue.toLocaleString()} gold
        </Typography>
      </Stack>
      {chartData.length === 0 ? (
        <Box sx={{ py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No {mode} data is available for the selected range.
          </Typography>
        </Box>
      ) : (
        <PieChart
          height={380}
          margin={{ top: 24, right: 24, bottom: 24, left: 24 }}
          series={[
            {
              innerRadius: 72,
              outerRadius: 132,
              paddingAngle: 2,
              cornerRadius: 4,
              data: chartData,
              valueFormatter: (value) => `${value.value.toLocaleString()} gold`,
            },
          ]}
          slotProps={{ legend: { hidden: false } }}
        />
      )}
    </Stack>
  )
}

export default PieBreakdownChart