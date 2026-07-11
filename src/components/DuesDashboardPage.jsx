import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material'
import { formatDisplayDate } from '../utils/dateFormatting'
import { buildMemberManagementSnapshot } from '../utils/memberDues'

const defaultSort = {
  orderBy: 'outstanding',
  order: 'desc',
}

const getMemberSortValue = (member, orderBy) => {
  switch (orderBy) {
    case 'effectiveDuesAmount':
      return Number(member.effectiveDuesAmount) || 0
    case 'cyclePaid':
      return Number(member.cyclePaid) || 0
    case 'outstanding':
      return Number(member.outstanding) || 0
    case 'lifetimeDues':
      return Number(member.contribution.dues) || 0
    case 'lifetimeDonations':
      return Number(member.contribution.donations) || 0
    case 'lastPaymentDate':
      return member.contribution.lastPaymentDate || ''
    case 'status':
      return member.status || ''
    default:
      return member.name || ''
  }
}

const compareValues = (leftValue, rightValue) => {
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue
  }

  return String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' })
}

const getStatusChipProps = (status) => {
  if (status === 'Paid') {
    return {
      label: 'Paid',
      color: 'success',
      variant: 'filled',
    }
  }

  if (status === 'Partial') {
    return {
      label: 'Overdue',
      color: 'error',
      variant: 'filled',
    }
  }

  if (status === 'Due') {
    return {
      label: 'Due',
      color: 'default',
      variant: 'outlined',
    }
  }

  return {
    label: status,
    color: 'default',
    variant: status === 'Inactive' || status === 'No dues set' || status === 'Excluded' ? 'outlined' : 'filled',
  }
}

function DuesDashboardPage({
  selectedGuild,
  entries,
  trackedMembers,
  overviewRef,
  historyRef,
  mutationPending,
  canEdit = true,
  onUpdateGuildDuesSettings,
  onUpdateTrackedMember,
  fmtGold,
}) {
  const snapshot = useMemo(
    () => buildMemberManagementSnapshot({ entries, trackedMembers, selectedGuild }),
    [entries, selectedGuild, trackedMembers],
  )
  const [defaultDuesAmountDraft, setDefaultDuesAmountDraft] = useState(
    String(snapshot.defaultDuesAmount),
  )
  const [rowDrafts, setRowDrafts] = useState({})
  const [sortConfig, setSortConfig] = useState(defaultSort)

  useEffect(() => {
    const syncDefaultTimeout = window.setTimeout(() => {
      setDefaultDuesAmountDraft(String(snapshot.defaultDuesAmount))
    }, 0)

    return () => {
      window.clearTimeout(syncDefaultTimeout)
    }
  }, [selectedGuild?.id, snapshot.defaultDuesAmount])

  useEffect(() => {
    const nextDrafts = {}
    for (const member of trackedMembers) {
      nextDrafts[member.id] = {
        name: member.name,
        duesAmount: String(member.duesAmount ?? 0),
        useDefaultDues: member.useDefaultDues !== false,
        duesExempt: Boolean(member.duesExempt),
        isActive: Boolean(member.isActive),
      }
    }

    const syncDraftsTimeout = window.setTimeout(() => {
      setRowDrafts(nextDrafts)
    }, 0)

    return () => {
      window.clearTimeout(syncDraftsTimeout)
    }
  }, [trackedMembers])

  const sortedMembers = useMemo(() => {
    const direction = sortConfig.order === 'asc' ? 1 : -1

    return [...snapshot.members].sort((left, right) => {
      const result = compareValues(
        getMemberSortValue(left, sortConfig.orderBy),
        getMemberSortValue(right, sortConfig.orderBy),
      )

      if (result !== 0) {
        return result * direction
      }

      return compareValues(left.name || '', right.name || '')
    })
  }, [snapshot.members, sortConfig])

  const handleSort = (orderBy) => {
    setSortConfig((prev) => ({
      orderBy,
      order: prev.orderBy === orderBy && prev.order === 'asc' ? 'desc' : 'asc',
    }))
  }

  if (!selectedGuild) {
    return <Alert severity="info">Select a guild to view dues.</Alert>
  }

  return (
    <Stack spacing={3}>
      <Card ref={overviewRef}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box>
              <Typography variant="h6">Dues Dashboard</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage dues settings and track payments for {selectedGuild.name}.
              </Typography>
              {!canEdit && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Viewer access is read-only. Only admins and owners can update dues settings.
                </Alert>
              )}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="guild-due-scheme-label">Dues scheme</InputLabel>
                <Select
                  labelId="guild-due-scheme-label"
                  label="Dues scheme"
                  value={snapshot.duesScheme}
                  disabled={mutationPending || !canEdit}
                  onChange={(event) => {
                    void onUpdateGuildDuesSettings({ dueScheme: event.target.value })
                  }}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Default dues amount"
                type="number"
                value={defaultDuesAmountDraft}
                disabled={!canEdit}
                onChange={(event) => setDefaultDuesAmountDraft(event.target.value)}
                sx={{ minWidth: { xs: '100%', sm: 210 } }}
              />
              <Button
                variant="outlined"
                disabled={mutationPending || !canEdit}
                onClick={() =>
                  void onUpdateGuildDuesSettings({
                    defaultDuesAmount: defaultDuesAmountDraft,
                  })
                }
              >
                Apply default
              </Button>
            </Stack>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
            <Chip label={`Scheme: ${snapshot.duesScheme === 'weekly' ? 'Weekly' : 'Monthly'}`} variant="outlined" />
            <Chip label={`Current cycle: ${snapshot.currentCycle.label}`} color="primary" variant="outlined" />
            <Chip label={`Guild default: ${fmtGold(snapshot.defaultDuesAmount)}`} variant="outlined" />
            <Chip label={`Expected: ${fmtGold(snapshot.summary.expected)}`} />
            <Chip label={`Collected: ${fmtGold(snapshot.summary.collected)}`} />
            <Chip
              label={`Outstanding: ${fmtGold(Math.max(snapshot.summary.expected - snapshot.summary.collected, 0))}`}
            />
            <Chip label={`Paid: ${snapshot.summary.paidCount}`} color="success" variant="outlined" />
            <Chip label={`Partial: ${snapshot.summary.partialCount}`} color="warning" variant="outlined" />
            <Chip label={`Due: ${snapshot.summary.dueCount}`} color="error" variant="outlined" />
            <Chip label={`Excluded: ${snapshot.summary.excludedCount}`} variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Weekly dues reset each Sunday in Eastern Time. Monthly dues reset on the first of each month.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Member Dues Tracking
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review the current cycle, sort the roster, and switch members between default and custom dues.
          </Typography>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.orderBy === 'name'}
                      direction={sortConfig.orderBy === 'name' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      Member
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortConfig.orderBy === 'effectiveDuesAmount'}
                      direction={sortConfig.orderBy === 'effectiveDuesAmount' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('effectiveDuesAmount')}
                    >
                      Dues amount
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.orderBy === 'status'}
                      direction={sortConfig.orderBy === 'status' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortConfig.orderBy === 'cyclePaid'}
                      direction={sortConfig.orderBy === 'cyclePaid' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('cyclePaid')}
                    >
                      This cycle
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortConfig.orderBy === 'outstanding'}
                      direction={sortConfig.orderBy === 'outstanding' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('outstanding')}
                    >
                      Outstanding
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortConfig.orderBy === 'lifetimeDues'}
                      direction={sortConfig.orderBy === 'lifetimeDues' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('lifetimeDues')}
                    >
                      Lifetime dues
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortConfig.orderBy === 'lifetimeDonations'}
                      direction={sortConfig.orderBy === 'lifetimeDonations' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('lifetimeDonations')}
                    >
                      Lifetime donations
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.orderBy === 'lastPaymentDate'}
                      direction={sortConfig.orderBy === 'lastPaymentDate' ? sortConfig.order : 'asc'}
                      onClick={() => handleSort('lastPaymentDate')}
                    >
                      Last payment
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No tracked members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedMembers.map((member) => {
                    const rowDraft = rowDrafts[member.id] || {
                      name: member.name,
                      duesAmount: String(member.duesAmount ?? 0),
                      useDefaultDues: member.useDefaultDues !== false,
                      duesExempt: Boolean(member.duesExempt),
                      isActive: Boolean(member.isActive),
                    }
                    const statusChip = getStatusChipProps(member.status)

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Stack spacing={0.5}>
                            <Typography variant="body2">{member.name}</Typography>
                            {!member.isActive && (
                              <Typography variant="caption" color="text.secondary">
                                Inactive roster member
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack spacing={1} alignItems="flex-end">
                            <TextField
                              size="small"
                              label="Dues amount"
                              type="number"
                              value={rowDraft.duesAmount}
                              disabled={!canEdit || rowDraft.duesExempt || rowDraft.useDefaultDues}
                              onChange={(event) =>
                                setRowDrafts((prev) => ({
                                  ...prev,
                                  [member.id]: { ...rowDraft, duesAmount: event.target.value },
                                }))
                              }
                              sx={{ width: 120 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Effective: {fmtGold(member.effectiveDuesAmount)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip
                              size="small"
                              label={statusChip.label}
                              color={statusChip.color}
                              variant={statusChip.variant}
                            />
                            <Chip
                              size="small"
                              label={rowDraft.duesExempt ? 'No dues required' : rowDraft.useDefaultDues ? `Uses guild default • ${fmtGold(snapshot.defaultDuesAmount)}` : 'Uses custom dues'}
                              variant="outlined"
                            />
                            <FormControlLabel
                              sx={{ mr: 0 }}
                              control={
                                <Checkbox
                                  checked={rowDraft.useDefaultDues}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    setRowDrafts((prev) => ({
                                      ...prev,
                                      [member.id]: { ...rowDraft, useDefaultDues: event.target.checked },
                                    }))
                                  }
                                />
                              }
                              label="Use guild default"
                            />
                            <FormControlLabel
                              sx={{ mr: 0 }}
                              control={
                                <Checkbox
                                  checked={rowDraft.duesExempt}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    setRowDrafts((prev) => ({
                                      ...prev,
                                      [member.id]: { ...rowDraft, duesExempt: event.target.checked },
                                    }))
                                  }
                                />
                              }
                              label="Excluded from dues"
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{fmtGold(member.cyclePaid)}</TableCell>
                        <TableCell align="right">{fmtGold(member.outstanding)}</TableCell>
                        <TableCell align="right">{fmtGold(member.contribution.dues)}</TableCell>
                        <TableCell align="right">{fmtGold(member.contribution.donations)}</TableCell>
                        <TableCell>{formatDisplayDate(member.contribution.lastPaymentDate) || 'No deposits yet'}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={mutationPending || !canEdit}
                            onClick={() =>
                              onUpdateTrackedMember(member.id, {
                                name: rowDraft.name,
                                duesAmount: rowDraft.duesAmount,
                                useDefaultDues: rowDraft.useDefaultDues,
                                duesExempt: rowDraft.duesExempt,
                                isActive: rowDraft.isActive,
                              })
                            }
                          >
                            Save dues
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Stack ref={historyRef} direction={{ xs: 'column', xl: 'row' }} spacing={3} alignItems="stretch">
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Dues History
            </Typography>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Member</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snapshot.dueHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No dues payments recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    snapshot.dueHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                        <TableCell>{entry.user || 'Unassigned member'}</TableCell>
                        <TableCell align="right">{fmtGold(entry.amount)}</TableCell>
                        <TableCell>{entry.notes || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Donation History
            </Typography>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Member</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snapshot.donationHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No donation deposits recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    snapshot.donationHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                        <TableCell>{entry.user || 'Unassigned member'}</TableCell>
                        <TableCell align="right">{fmtGold(entry.amount)}</TableCell>
                        <TableCell>{entry.notes || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  )
}

export default DuesDashboardPage
