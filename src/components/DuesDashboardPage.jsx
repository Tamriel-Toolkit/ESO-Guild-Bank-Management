import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
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
  TextField,
  Typography,
} from '@mui/material'

const EST_TIME_ZONE = 'America/New_York'
const EST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: EST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const defaultNewMemberDraft = {
  name: '',
  duesAmount: '',
  useDefaultDues: true,
  duesExempt: false,
  isActive: true,
}

const toMemberKey = (value) => String(value || '').trim().toLowerCase()

const getCurrentEstDateParts = () => {
  const parts = EST_DATE_FORMATTER.formatToParts(new Date())
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  }
}

const createUtcDate = ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day))

const toIsoDate = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

const addDays = (date, amount) => {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + amount)
  return nextDate
}

const formatCycleDate = (date) =>
  date.toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const getMonthlyCycle = () => {
  const { year, month } = getCurrentEstDateParts()
  const startDate = createUtcDate({ year, month, day: 1 })
  const endDate = new Date(Date.UTC(year, month, 0))

  return {
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    label: startDate.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'long', year: 'numeric' }),
  }
}

const getWeeklyCycle = () => {
  const today = createUtcDate(getCurrentEstDateParts())
  const startDate = addDays(today, -today.getUTCDay())
  const endDate = addDays(startDate, 6)

  return {
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    label: `${formatCycleDate(startDate)} - ${formatCycleDate(endDate)}`,
  }
}

const getCycleForScheme = (dueScheme) => (dueScheme === 'weekly' ? getWeeklyCycle() : getMonthlyCycle())

function DuesDashboardPage({
  selectedGuild,
  entries,
  trackedMembers,
  overviewRef,
  rosterRef,
  historyRef,
  mutationPending,
  onUpdateGuildDuesSettings,
  onCreateTrackedMember,
  onUpdateTrackedMember,
  onDeleteTrackedMember,
  fmtGold,
}) {
  const [newMemberDraft, setNewMemberDraft] = useState(defaultNewMemberDraft)
  const [rowDrafts, setRowDrafts] = useState({})
  const duesScheme = selectedGuild?.dueScheme === 'weekly' ? 'weekly' : 'monthly'
  const defaultDuesAmount = Number(selectedGuild?.defaultDuesAmount) || 0
  const [defaultDuesAmountDraft, setDefaultDuesAmountDraft] = useState(String(defaultDuesAmount))

  useEffect(() => {
    const syncDefaultTimeout = window.setTimeout(() => {
      setDefaultDuesAmountDraft(String(defaultDuesAmount))
    }, 0)

    return () => {
      window.clearTimeout(syncDefaultTimeout)
    }
  }, [defaultDuesAmount, selectedGuild?.id])

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

  const dueEntries = useMemo(
    () => entries.filter((entry) => entry.type === 'deposit' && entry.isDue),
    [entries],
  )

  const donationEntries = useMemo(
    () => entries.filter((entry) => entry.type === 'deposit' && entry.isDonation),
    [entries],
  )

  const lifetimeContributionTotals = useMemo(() => {
    const totals = new Map()
    for (const entry of entries) {
      if (entry.type !== 'deposit') {
        continue
      }

      const key = toMemberKey(entry.user)
      const previous = totals.get(key) || { dues: 0, donations: 0, deposits: 0, lastPaymentDate: '' }
      totals.set(key, {
        dues: previous.dues + (entry.isDue ? Number(entry.amount) || 0 : 0),
        donations: previous.donations + (entry.isDonation ? Number(entry.amount) || 0 : 0),
        deposits: previous.deposits + (Number(entry.amount) || 0),
        lastPaymentDate: previous.lastPaymentDate > entry.date ? previous.lastPaymentDate : entry.date,
      })
    }
    return totals
  }, [entries])

  const currentCycle = useMemo(() => getCycleForScheme(duesScheme), [duesScheme])

  const memberRows = useMemo(
    () =>
      trackedMembers.map((member) => {
        const cyclePaid = dueEntries.reduce((total, entry) => {
          if (entry.date < currentCycle.startDate || entry.date > currentCycle.endDate) {
            return total
          }

          return toMemberKey(entry.user) === toMemberKey(member.name)
            ? total + (Number(entry.amount) || 0)
            : total
        }, 0)
        const effectiveDuesAmount = member.useDefaultDues ? defaultDuesAmount : Number(member.duesAmount) || 0
        const totalExpected = member.duesExempt || !member.isActive ? 0 : effectiveDuesAmount
        const contribution = lifetimeContributionTotals.get(toMemberKey(member.name)) || {
          dues: 0,
          donations: 0,
          deposits: 0,
          lastPaymentDate: '',
        }

        const status = !member.isActive
          ? 'Inactive'
          : member.duesExempt
            ? 'Excluded'
            : totalExpected <= 0
              ? 'No dues set'
              : cyclePaid >= totalExpected
                ? 'Paid'
                : cyclePaid > 0
                  ? 'Partial'
                  : 'Due'

        return {
          ...member,
          cyclePaid,
          effectiveDuesAmount,
          totalExpected,
          outstanding: Math.max(totalExpected - cyclePaid, 0),
          status,
          contribution,
        }
      }),
    [currentCycle.endDate, currentCycle.startDate, defaultDuesAmount, dueEntries, lifetimeContributionTotals, trackedMembers],
  )

  const summary = useMemo(
    () => ({
      expected: memberRows.reduce(
        (total, member) => total + (member.isActive && !member.duesExempt ? member.totalExpected : 0),
        0,
      ),
      collected: memberRows.reduce((total, member) => total + member.cyclePaid, 0),
      paidCount: memberRows.filter((member) => member.status === 'Paid').length,
      partialCount: memberRows.filter((member) => member.status === 'Partial').length,
      dueCount: memberRows.filter((member) => member.status === 'Due').length,
      excludedCount: memberRows.filter((member) => member.status === 'Excluded').length,
    }),
    [memberRows],
  )

  const recentDueHistory = useMemo(
    () => [...dueEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8),
    [dueEntries],
  )

  const recentDonationHistory = useMemo(
    () => [...donationEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8),
    [donationEntries],
  )

  if (!selectedGuild) {
    return <Alert severity="info">Choose a guild before opening member management.</Alert>
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
              <Typography variant="h6">Member Management</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage shared dues settings, automated calendar resets, and recurring member activity for {selectedGuild.name}.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="guild-due-scheme-label">Dues scheme</InputLabel>
                <Select
                  labelId="guild-due-scheme-label"
                  label="Dues scheme"
                  value={duesScheme}
                  disabled={mutationPending}
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
                onChange={(event) => setDefaultDuesAmountDraft(event.target.value)}
                sx={{ minWidth: { xs: '100%', sm: 210 } }}
              />
              <Button
                variant="outlined"
                disabled={mutationPending}
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
            <Chip label={`Scheme: ${duesScheme === 'weekly' ? 'Weekly' : 'Monthly'}`} variant="outlined" />
            <Chip label={`Current cycle: ${currentCycle.label}`} color="primary" variant="outlined" />
            <Chip label={`Guild default: ${fmtGold(defaultDuesAmount)}`} variant="outlined" />
            <Chip label={`Expected: ${fmtGold(summary.expected)}`} />
            <Chip label={`Collected: ${fmtGold(summary.collected)}`} />
            <Chip label={`Outstanding: ${fmtGold(Math.max(summary.expected - summary.collected, 0))}`} />
            <Chip label={`Paid: ${summary.paidCount}`} color="success" variant="outlined" />
            <Chip label={`Partial: ${summary.partialCount}`} color="warning" variant="outlined" />
            <Chip label={`Due: ${summary.dueCount}`} color="error" variant="outlined" />
            <Chip label={`Excluded: ${summary.excludedCount}`} variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Weekly dues reset automatically at the start of Sunday in Eastern Time. Monthly dues reset automatically on the first day of each month in Eastern Time.
          </Typography>
        </CardContent>
      </Card>

      <Card ref={rosterRef}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Guild Member Roster
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add tracked members to this guild, use the shared {duesScheme} dues scheme, and mark anyone who is permanently excluded from owing dues.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Member name"
              value={newMemberDraft.name}
              onChange={(event) =>
                setNewMemberDraft((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <TextField
              label="Custom dues amount"
              type="number"
              value={newMemberDraft.duesAmount}
              onChange={(event) =>
                setNewMemberDraft((prev) => ({ ...prev, duesAmount: event.target.value }))
              }
              disabled={newMemberDraft.duesExempt || newMemberDraft.useDefaultDues}
              sx={{ minWidth: 160 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newMemberDraft.useDefaultDues}
                  onChange={(event) =>
                    setNewMemberDraft((prev) => ({ ...prev, useDefaultDues: event.target.checked }))
                  }
                />
              }
              label="Use guild default dues"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newMemberDraft.duesExempt}
                  onChange={(event) =>
                    setNewMemberDraft((prev) => ({ ...prev, duesExempt: event.target.checked }))
                  }
                />
              }
              label="Permanently excluded from dues"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newMemberDraft.isActive}
                  onChange={(event) =>
                    setNewMemberDraft((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
              }
              label="Active"
            />
            <Button
              variant="contained"
              disabled={mutationPending}
              onClick={async () => {
                const wasSaved = await onCreateTrackedMember({
                  name: newMemberDraft.name,
                  duesAmount: newMemberDraft.duesAmount,
                  useDefaultDues: newMemberDraft.useDefaultDues,
                  duesExempt: newMemberDraft.duesExempt,
                  isActive: newMemberDraft.isActive,
                })

                if (wasSaved) {
                  setNewMemberDraft(defaultNewMemberDraft)
                }
              }}
            >
              Add member
            </Button>
          </Stack>

          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 840 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell align="right">Dues amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">This cycle</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell align="right">Lifetime dues</TableCell>
                  <TableCell align="right">Lifetime donations</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {memberRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No tracked members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  memberRows.map((member) => {
                    const rowDraft = rowDrafts[member.id] || {
                      name: member.name,
                      duesAmount: String(member.duesAmount ?? 0),
                      useDefaultDues: member.useDefaultDues !== false,
                      duesExempt: Boolean(member.duesExempt),
                      isActive: Boolean(member.isActive),
                    }

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Stack spacing={1}>
                            <TextField
                              size="small"
                              value={rowDraft.name}
                              onChange={(event) =>
                                setRowDrafts((prev) => ({
                                  ...prev,
                                  [member.id]: { ...rowDraft, name: event.target.value },
                                }))
                              }
                            />
                            <Typography variant="caption" color="text.secondary">
                              Last payment: {member.contribution.lastPaymentDate || 'No deposits yet'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack spacing={1} alignItems="flex-end">
                            <TextField
                              size="small"
                              type="number"
                              value={rowDraft.duesAmount}
                              disabled={rowDraft.duesExempt || rowDraft.useDefaultDues}
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
                              label={member.status}
                              color={member.status === 'Paid' ? 'success' : member.status === 'Partial' ? 'warning' : member.status === 'Due' ? 'error' : 'default'}
                              variant={member.status === 'Inactive' || member.status === 'No dues set' || member.status === 'Excluded' ? 'outlined' : 'filled'}
                            />
                            <Chip
                              size="small"
                              label={rowDraft.duesExempt ? 'No dues required' : rowDraft.useDefaultDues ? `Uses guild default • ${fmtGold(defaultDuesAmount)}` : 'Uses custom dues'}
                              variant="outlined"
                            />
                            <FormControlLabel
                              sx={{ mr: 0 }}
                              control={
                                <Checkbox
                                  checked={rowDraft.useDefaultDues}
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
                            <FormControlLabel
                              sx={{ mr: 0 }}
                              control={
                                <Checkbox
                                  checked={rowDraft.isActive}
                                  onChange={(event) =>
                                    setRowDrafts((prev) => ({
                                      ...prev,
                                      [member.id]: { ...rowDraft, isActive: event.target.checked },
                                    }))
                                  }
                                />
                              }
                              label="Active"
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{fmtGold(member.cyclePaid)}</TableCell>
                        <TableCell align="right">{fmtGold(member.outstanding)}</TableCell>
                        <TableCell align="right">{fmtGold(member.contribution.dues)}</TableCell>
                        <TableCell align="right">{fmtGold(member.contribution.donations)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={mutationPending}
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
                              Save
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              disabled={mutationPending}
                              onClick={() => onDeleteTrackedMember(member)}
                            >
                              Delete
                            </Button>
                          </Stack>
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
            <TableContainer>
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
                  {recentDueHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No dues payments recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentDueHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
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
            <TableContainer>
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
                  {recentDonationHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No donation deposits recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentDonationHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
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
