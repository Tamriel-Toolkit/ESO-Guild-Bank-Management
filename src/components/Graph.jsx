import { useState } from 'react'
import { LineChart } from '@mui/x-charts/LineChart'
import { Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'

const seriesOptions = [
    { id: 'deposit', label: 'Deposits', color: '#00897b' },
    { id: 'dues', label: 'Dues', color: '#00acc1' },
    { id: 'salesTax', label: 'Sales Tax', color: '#3949ab' },
    { id: 'withdrawal', label: 'Withdrawals', color: '#ef6c00' },
    { id: 'net', label: 'Net Total', color: '#c62828' },
]

function Graph({ entries, statisticsRange }) {
    const [visibleSeries, setVisibleSeries] = useState(() => ({
        deposit: true,
                dues: false,
        salesTax: true,
                withdrawal: true,
        net: true,
    }))

    const filteredEntries = entries
        .filter((entry) => entry.date >= statisticsRange.startDate && entry.date <= statisticsRange.endDate)
        .sort((leftEntry, rightEntry) => leftEntry.date.localeCompare(rightEntry.date))

    const pointsByDate = filteredEntries.reduce((points, entry) => {
        const currentPoint = points.get(entry.date) ?? {
            date: entry.date,
            deposit: 0,
            dues: 0,
            salesTax: 0,
            withdrawal: 0,
            net: 0,
        }

        if (entry.type === 'deposit') {
            currentPoint.deposit += entry.amount
            if (entry.isDue) {
                currentPoint.dues += entry.amount
            }
            currentPoint.net += entry.amount
        }

        if (entry.type === 'withdrawal') {
            currentPoint.withdrawal += entry.amount
            currentPoint.net -= entry.amount
        }

        if (entry.type === 'salesTax') {
            currentPoint.salesTax += entry.amount
            currentPoint.net += entry.amount
        }

        points.set(entry.date, currentPoint)
        return points
    }, new Map())

    const chartRows = [...pointsByDate.values()]
    const activeSeries = seriesOptions
        .filter((seriesOption) => visibleSeries[seriesOption.id])
        .map((seriesOption) => ({
            id: seriesOption.id,
            label: seriesOption.label,
            data: chartRows.map((row) => row[seriesOption.id]),
            color: seriesOption.color,
        }))

    if (chartRows.length === 0) {
        return (
            <Box sx={{ py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    No statistics data is available for the selected range.
                </Typography>
            </Box>
        )
    }

    if (activeSeries.length === 0) {
        return (
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                    {seriesOptions.map((seriesOption) => (
                        <FormControlLabel
                            key={seriesOption.id}
                            control={
                                <Checkbox
                                    checked={visibleSeries[seriesOption.id]}
                                    onChange={(event) =>
                                        setVisibleSeries((prev) => ({
                                            ...prev,
                                            [seriesOption.id]: event.target.checked,
                                        }))
                                    }
                                />
                            }
                            label={seriesOption.label}
                        />
                    ))}
                </Stack>
                <Box sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Select at least one line type to display the graph.
                    </Typography>
                </Box>
            </Stack>
        )
    }

    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                {seriesOptions.map((seriesOption) => (
                    <FormControlLabel
                        key={seriesOption.id}
                        control={
                            <Checkbox
                                checked={visibleSeries[seriesOption.id]}
                                onChange={(event) =>
                                    setVisibleSeries((prev) => ({
                                        ...prev,
                                        [seriesOption.id]: event.target.checked,
                                    }))
                                }
                            />
                        }
                        label={seriesOption.label}
                    />
                ))}
            </Stack>
            <LineChart
                height={320}
                margin={{ top: 24, right: 24, bottom: 24, left: 56 }}
                xAxis={[
                    {
                        scaleType: 'point',
                        data: chartRows.map((row) => row.date),
                    },
                ]}
                series={activeSeries}
                slotProps={{ legend: { hidden: false } }}
            />
        </Stack>
    )
}

export default Graph