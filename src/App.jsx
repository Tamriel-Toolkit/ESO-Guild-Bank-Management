import { useEffect, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Toolbar,
  Typography,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import './App.css'

const STORAGE_KEY = 'eso-guild-bank-management-v1'
const SESSION_USER_KEY = 'eso-guild-bank-session-user'

const todayString = () => new Date().toISOString().slice(0, 10)

const createEmptyState = () => ({
  guest: {
    entries: [],
    weekStartDate: todayString(),
  },
  users: {},
})

const parseStoredState = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return createEmptyState()
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      guest: {
        entries: Array.isArray(parsed?.guest?.entries) ? parsed.guest.entries : [],
        weekStartDate: parsed?.guest?.weekStartDate || todayString(),
      },
      users: parsed?.users && typeof parsed.users === 'object' ? parsed.users : {},
    }
  } catch {
    return createEmptyState()
  }
}

const parseStoredSessionUser = () => {
  const raw = localStorage.getItem(SESSION_USER_KEY)
  return raw?.trim() ? raw : null
}

const createEntry = (draft) => ({
  id: crypto.randomUUID(),
  type: draft.type,
  amount: Number(draft.amount),
  date: draft.date,
  notes: draft.notes.trim(),
})

const entryTypes = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'salesTax', label: 'Sales Tax' },
]

const defaultEntryDraft = {
  type: 'deposit',
  amount: '',
  date: todayString(),
  notes: '',
}

const entryPageSizeOptions = [10, 25, 50, 100]

const sortableEntryColumns = {
  date: {
    label: 'Date',
    getValue: (entry) => entry.date,
  },
  type: {
    label: 'Type',
    getValue: (entry) => entryTypes.find((entryType) => entryType.value === entry.type)?.label ?? '',
  },
  amount: {
    label: 'Amount',
    getValue: (entry) => Number(entry.amount) || 0,
  },
  notes: {
    label: 'Notes',
    getValue: (entry) => entry.notes || '',
  },
}

const guildDrawerWidth = 320

const isoToDay = (isoDate) => new Date(`${isoDate}T00:00:00`)

const computeTotals = (entries, filter) =>
  entries.reduce(
    (totals, entry) => {
      if (!filter(entry)) {
        return totals
      }

      totals[entry.type] += Number(entry.amount) || 0
      return totals
    },
    { deposit: 0, withdrawal: 0, salesTax: 0 },
  )

const fmtGold = (value) => `${Math.round(value).toLocaleString()}g`

const statsRows = (entries, weekStartDate) => {
  const now = new Date()
  const today = todayString()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const weekStart = isoToDay(weekStartDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  return [
    {
      label: 'Daily',
      totals: computeTotals(entries, (entry) => entry.date === today),
    },
    {
      label: 'Weekly',
      totals: computeTotals(entries, (entry) => {
        const entryDate = isoToDay(entry.date)
        return entryDate >= weekStart && entryDate < weekEnd
      }),
    },
    {
      label: 'Monthly',
      totals: computeTotals(entries, (entry) => entry.date.startsWith(month)),
    },
    {
      label: 'Overall',
      totals: computeTotals(entries, () => true),
    },
  ]
}

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#b08a4a' },
    background: { default: '#11100e', paper: '#1a1714' },
    secondary: { main: '#8a6a34' },
  },
  typography: {
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
    h4: { letterSpacing: 1 },
  },
})

function App() {
  const [appState, setAppState] = useState(parseStoredState)
  const [sessionUser, setSessionUser] = useState(parseStoredSessionUser)
  const [entryDraft, setEntryDraft] = useState(defaultEntryDraft)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authDraft, setAuthDraft] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [newGuildName, setNewGuildName] = useState('')
  const [editingEntry, setEditingEntry] = useState(null)
  const [entryPage, setEntryPage] = useState(1)
  const [entriesPerPage, setEntriesPerPage] = useState(entryPageSizeOptions[0])
  const [entrySort, setEntrySort] = useState({ column: 'date', direction: 'desc' })

  const currentUser = sessionUser ? appState.users[sessionUser] : null
  const selectedGuild =
    currentUser?.guilds?.find((guild) => guild.id === currentUser.selectedGuildId) ?? null

  const activeEntries = sessionUser ? selectedGuild?.entries ?? [] : appState.guest.entries
  const weekStartDate = sessionUser
    ? selectedGuild?.weekStartDate || todayString()
    : appState.guest.weekStartDate

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState))
  }, [appState])

  useEffect(() => {
    if (sessionUser && !appState.users[sessionUser]) {
      setSessionUser(null)
    }
  }, [appState.users, sessionUser])

  useEffect(() => {
    if (sessionUser) {
      localStorage.setItem(SESSION_USER_KEY, sessionUser)
      return
    }

    localStorage.removeItem(SESSION_USER_KEY)
  }, [sessionUser])

  useEffect(() => {
    setEntryPage(1)
  }, [sessionUser, selectedGuild?.id, entriesPerPage, entrySort.column, entrySort.direction])

  const stats = statsRows(activeEntries, weekStartDate)
  const sortedEntries = [...activeEntries].sort((leftEntry, rightEntry) => {
    const leftValue = sortableEntryColumns[entrySort.column].getValue(leftEntry)
    const rightValue = sortableEntryColumns[entrySort.column].getValue(rightEntry)

    if (leftValue === rightValue) {
      return 0
    }

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return entrySort.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
    }

    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    })

    return entrySort.direction === 'asc' ? comparison : -comparison
  })
  const totalEntryPages = Math.max(1, Math.ceil(sortedEntries.length / entriesPerPage))
  const visibleEntries = sortedEntries.slice(
    (entryPage - 1) * entriesPerPage,
    entryPage * entriesPerPage,
  )

  useEffect(() => {
    setEntryPage((prev) => Math.min(prev, totalEntryPages))
  }, [totalEntryPages])

  const updateGuest = (updater) => {
    setAppState((prev) => ({
      ...prev,
      guest: updater(prev.guest),
    }))
  }

  const updateCurrentUser = (updater) => {
    if (!sessionUser) {
      return
    }

    setAppState((prev) => ({
      ...prev,
      users: {
        ...prev.users,
        [sessionUser]: updater(prev.users[sessionUser]),
      },
    }))
  }

  const updateSelectedGuild = (updater) => {
    if (!sessionUser || !selectedGuild) {
      return
    }

    updateCurrentUser((user) => ({
      ...user,
      guilds: user.guilds.map((guild) =>
        guild.id === selectedGuild.id ? updater(guild) : guild,
      ),
    }))
  }

  const handleEntrySort = (column) => {
    setEntrySort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const saveEntry = () => {
    if (!entryDraft.amount || Number(entryDraft.amount) <= 0 || !entryDraft.date) {
      return
    }

    const nextEntry = createEntry(entryDraft)

    if (sessionUser) {
      if (!selectedGuild) {
        return
      }

      updateSelectedGuild((guild) => ({
        ...guild,
        entries: [nextEntry, ...guild.entries],
      }))
    } else {
      updateGuest((guest) => ({
        ...guest,
        entries: [nextEntry, ...guest.entries],
      }))
    }

    setEntryDraft({ ...defaultEntryDraft, date: todayString() })
  }

  const updateEntry = (entryId, updater) => {
    if (sessionUser) {
      updateSelectedGuild((guild) => ({
        ...guild,
        entries: guild.entries.map((entry) =>
          entry.id === entryId ? updater(entry) : entry,
        ),
      }))
      return
    }

    updateGuest((guest) => ({
      ...guest,
      entries: guest.entries.map((entry) =>
        entry.id === entryId ? updater(entry) : entry,
      ),
    }))
  }

  const deleteEntry = (entryId) => {
    if (sessionUser) {
      updateSelectedGuild((guild) => ({
        ...guild,
        entries: guild.entries.filter((entry) => entry.id !== entryId),
      }))
      return
    }

    updateGuest((guest) => ({
      ...guest,
      entries: guest.entries.filter((entry) => entry.id !== entryId),
    }))
  }

  const handleAuth = () => {
    const username = authDraft.username.trim().toLowerCase()
    const password = authDraft.password

    if (!username || !password) {
      setAuthError('Enter both a username and password.')
      return
    }

    const existing = appState.users[username]

    if (authMode === 'signup') {
      if (existing) {
        setAuthError('That username already exists.')
        return
      }
    } else if (!existing || existing.password !== password) {
      setAuthError('Invalid username or password.')
      return
    }

    setAppState((prev) => {
      const users = { ...prev.users }
      if (authMode === 'signup') {
        users[username] = {
          password,
          guilds: [],
          selectedGuildId: null,
        }
      }

      const user = users[username]
      const hasGuestEntries = prev.guest.entries.length > 0
      const hasAccountData = user.guilds.some((guild) => guild.entries.length > 0)
      let nextGuest = prev.guest
      let nextGuilds = user.guilds
      let nextSelectedGuildId = user.selectedGuildId

      if (hasGuestEntries) {
        if (!hasAccountData) {
          const guildId = crypto.randomUUID()
          nextGuilds = [
            ...user.guilds,
            {
              id: guildId,
              name: 'Imported Guest Guild',
              entries: prev.guest.entries,
              weekStartDate: prev.guest.weekStartDate,
            },
          ]
          nextSelectedGuildId = nextSelectedGuildId || guildId
        } else if (
          window.confirm(
            'This account already has data. Save your current guest page as a new guild profile?',
          )
        ) {
          const guildId = crypto.randomUUID()
          nextGuilds = [
            ...user.guilds,
            {
              id: guildId,
              name: `Imported Guest Guild ${user.guilds.length + 1}`,
              entries: prev.guest.entries,
              weekStartDate: prev.guest.weekStartDate,
            },
          ]
          nextSelectedGuildId = guildId
        }

        nextGuest = {
          entries: [],
          weekStartDate: todayString(),
        }
      }

      if (!nextSelectedGuildId && nextGuilds.length > 0) {
        nextSelectedGuildId = nextGuilds[0].id
      }

      users[username] = {
        ...user,
        guilds: nextGuilds,
        selectedGuildId: nextSelectedGuildId,
      }

      return {
        ...prev,
        guest: nextGuest,
        users,
      }
    })

    setSessionUser(username)
    setAuthOpen(false)
    setAuthError('')
    setAuthDraft({ username: '', password: '' })
  }

  const createGuild = () => {
    if (!newGuildName.trim()) {
      return
    }

    const guildId = crypto.randomUUID()
    updateCurrentUser((user) => ({
      ...user,
      guilds: [
        ...user.guilds,
        {
          id: guildId,
          name: newGuildName.trim(),
          entries: [],
          weekStartDate: todayString(),
        },
      ],
      selectedGuildId: guildId,
    }))
    setNewGuildName('')
  }

  const renameGuild = (guildId, currentName) => {
    const nextName = window.prompt('Guild name', currentName)
    if (!nextName?.trim()) {
      return
    }

    updateCurrentUser((user) => ({
      ...user,
      guilds: user.guilds.map((guild) =>
        guild.id === guildId ? { ...guild, name: nextName.trim() } : guild,
      ),
    }))
  }

  const deleteGuild = (guildId) => {
    if (!window.confirm('Delete this guild profile and all of its entries?')) {
      return
    }

    updateCurrentUser((user) => {
      const nextGuilds = user.guilds.filter((guild) => guild.id !== guildId)
      return {
        ...user,
        guilds: nextGuilds,
        selectedGuildId:
          user.selectedGuildId === guildId ? nextGuilds[0]?.id ?? null : user.selectedGuildId,
      }
    })
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="eso-bg" sx={{ minHeight: '100vh', pb: 6 }}>
        <AppBar position="static" color="transparent" sx={{ backdropFilter: 'blur(4px)' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              ESO Guild Bank Management
            </Typography>
            {sessionUser ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`Logged in: ${sessionUser}`} color="primary" />
                <Button color="inherit" onClick={() => setSessionUser(null)}>
                  Log out
                </Button>
              </Stack>
            ) : (
              <Button color="inherit" onClick={() => setAuthOpen(true)}>
                Sign up / Log in
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ display: 'flex' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
            <Typography variant="h4" gutterBottom>
              Track Guild Gold Flow
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              Log deposits, withdrawals, and sales tax income with editable notes.
            </Typography>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Add Entry
                </Typography>
                {sessionUser && !selectedGuild ? (
                  <Alert severity="info">Create a guild profile in the right sidebar first.</Alert>
                ) : (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id="entry-type-label">Type</InputLabel>
                      <Select
                        labelId="entry-type-label"
                        label="Type"
                        value={entryDraft.type}
                        onChange={(event) =>
                          setEntryDraft((prev) => ({ ...prev, type: event.target.value }))
                        }
                      >
                        {entryTypes.map((entryType) => (
                          <MenuItem key={entryType.value} value={entryType.value}>
                            {entryType.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      label="Gold Amount"
                      type="number"
                      value={entryDraft.amount}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, amount: event.target.value }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Date"
                      type="date"
                      value={entryDraft.date}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, date: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      fullWidth
                      label="Optional Notes"
                      value={entryDraft.notes}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, notes: event.target.value }))
                      }
                    />
                    <Button variant="contained" onClick={saveEntry}>
                      Save
                    </Button>
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6">Stats</Typography>
                  <TextField
                    label="Weekly stats start"
                    type="date"
                    value={weekStartDate}
                    onChange={(event) => {
                      const nextDate = event.target.value
                      if (sessionUser) {
                        updateSelectedGuild((guild) => ({ ...guild, weekStartDate: nextDate }))
                      } else {
                        updateGuest((guest) => ({ ...guest, weekStartDate: nextDate }))
                      }
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ maxWidth: 250 }}
                  />
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Range</TableCell>
                      <TableCell align="right">Deposits</TableCell>
                      <TableCell align="right">Withdrawals</TableCell>
                      <TableCell align="right">Sales Tax</TableCell>
                      <TableCell align="right">Grand Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.map((statRow) => {
                      const grandTotal =
                        statRow.totals.deposit + statRow.totals.salesTax - statRow.totals.withdrawal
                      return (
                        <TableRow key={statRow.label}>
                          <TableCell>{statRow.label}</TableCell>
                          <TableCell align="right">{fmtGold(statRow.totals.deposit)}</TableCell>
                          <TableCell align="right">{fmtGold(statRow.totals.withdrawal)}</TableCell>
                          <TableCell align="right">{fmtGold(statRow.totals.salesTax)}</TableCell>
                          <TableCell align="right">{fmtGold(grandTotal)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  useFlexGap
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mb: 2 }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    useFlexGap
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                  >
                    <Typography variant="h6">Log Entries</Typography>
                    <Pagination
                      color="primary"
                      count={totalEntryPages}
                      page={entryPage}
                      onChange={(_event, value) => setEntryPage(value)}
                      size="small"
                      showFirstButton
                      showLastButton
                      siblingCount={0}
                      boundaryCount={1}
                    />
                  </Stack>
                  <FormControl size="small" sx={{ minWidth: 150, alignSelf: { xs: 'flex-end', md: 'auto' } }}>
                    <InputLabel id="entries-per-page-label">Entries per page</InputLabel>
                    <Select
                      labelId="entries-per-page-label"
                      value={entriesPerPage}
                      label="Entries per page"
                      onChange={(event) => setEntriesPerPage(Number(event.target.value))}
                    >
                      {entryPageSizeOptions.map((pageSize) => (
                        <MenuItem key={pageSize} value={pageSize}>
                          {pageSize}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sortDirection={entrySort.column === 'date' ? entrySort.direction : false}>
                        <TableSortLabel
                          active={entrySort.column === 'date'}
                          direction={entrySort.column === 'date' ? entrySort.direction : 'asc'}
                          onClick={() => handleEntrySort('date')}
                        >
                          Date
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sortDirection={entrySort.column === 'type' ? entrySort.direction : false}>
                        <TableSortLabel
                          active={entrySort.column === 'type'}
                          direction={entrySort.column === 'type' ? entrySort.direction : 'asc'}
                          onClick={() => handleEntrySort('type')}
                        >
                          Type
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        align="right"
                        sortDirection={entrySort.column === 'amount' ? entrySort.direction : false}
                      >
                        <TableSortLabel
                          active={entrySort.column === 'amount'}
                          direction={entrySort.column === 'amount' ? entrySort.direction : 'asc'}
                          onClick={() => handleEntrySort('amount')}
                        >
                          Amount
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sortDirection={entrySort.column === 'notes' ? entrySort.direction : false}>
                        <TableSortLabel
                          active={entrySort.column === 'notes'}
                          direction={entrySort.column === 'notes' ? entrySort.direction : 'asc'}
                          onClick={() => handleEntrySort('notes')}
                        >
                          Notes
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No entries yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.date}</TableCell>
                          <TableCell>
                            {entryTypes.find((entryType) => entryType.value === entry.type)?.label}
                          </TableCell>
                          <TableCell align="right">{fmtGold(entry.amount)}</TableCell>
                          <TableCell>{entry.notes || '—'}</TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => setEditingEntry({ ...entry })}>
                              <EditIcon />
                            </IconButton>
                            <IconButton onClick={() => deleteEntry(entry.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Box>

          {sessionUser && (
            <Drawer
              anchor="right"
              variant="permanent"
              sx={{
                width: guildDrawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: guildDrawerWidth,
                  boxSizing: 'border-box',
                  p: 2,
                  top: { xs: 56, sm: 64 },
                  height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
                },
              }}
            >
              <Typography variant="h6" sx={{ mt: 1 }}>
                Guild Profiles
              </Typography>
              <Stack direction="row" spacing={1} sx={{ my: 2 }}>
                <TextField
                  size="small"
                  label="New guild"
                  value={newGuildName}
                  onChange={(event) => setNewGuildName(event.target.value)}
                  fullWidth
                />
                <Button variant="contained" onClick={createGuild}>
                  Add
                </Button>
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <List dense>
                {currentUser?.guilds?.map((guild) => (
                  <ListItem
                    key={guild.id}
                    disablePadding
                    secondaryAction={
                      <Stack direction="row" spacing={0.5}>
                        <IconButton edge="end" onClick={() => renameGuild(guild.id, guild.name)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton edge="end" onClick={() => deleteGuild(guild.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemButton
                      selected={guild.id === currentUser.selectedGuildId}
                      onClick={() =>
                        updateCurrentUser((user) => ({ ...user, selectedGuildId: guild.id }))
                      }
                    >
                      <ListItemText
                        primary={guild.name}
                        secondary={`${guild.entries.length} entries`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Drawer>
          )}

          {sessionUser && <Box sx={{ width: guildDrawerWidth, flexShrink: 0 }} />}
        </Box>
      </Box>

      <Dialog open={authOpen} onClose={() => setAuthOpen(false)}>
        <DialogTitle>{authMode === 'login' ? 'Log in' : 'Create account'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
            {authError && <Alert severity="error">{authError}</Alert>}
            <TextField
              label="Username"
              value={authDraft.username}
              onChange={(event) =>
                setAuthDraft((prev) => ({ ...prev, username: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={authDraft.password}
              onChange={(event) =>
                setAuthDraft((prev) => ({ ...prev, password: event.target.value }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
              setAuthError('')
            }}
          >
            {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
          </Button>
          <Button variant="contained" onClick={handleAuth}>
            {authMode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingEntry)} onClose={() => setEditingEntry(null)}>
        <DialogTitle>Edit Entry</DialogTitle>
        <DialogContent>
          {editingEntry && (
            <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
              <FormControl fullWidth>
                <InputLabel id="edit-entry-type">Type</InputLabel>
                <Select
                  labelId="edit-entry-type"
                  label="Type"
                  value={editingEntry.type}
                  onChange={(event) =>
                    setEditingEntry((prev) => ({ ...prev, type: event.target.value }))
                  }
                >
                  {entryTypes.map((entryType) => (
                    <MenuItem key={entryType.value} value={entryType.value}>
                      {entryType.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Amount"
                type="number"
                value={editingEntry.amount}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, amount: Number(event.target.value) }))
                }
              />
              <TextField
                label="Date"
                type="date"
                value={editingEntry.date}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, date: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Notes"
                value={editingEntry.notes}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, notes: event.target.value }))
                }
                multiline
                minRows={2}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingEntry(null)}>Cancel</Button>
          <Button
            onClick={() =>
              setEditingEntry((prev) => ({
                ...prev,
                notes: '',
              }))
            }
          >
            Remove Notes
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editingEntry.amount <= 0) {
                return
              }

              updateEntry(editingEntry.id, () => ({
                ...editingEntry,
                notes: editingEntry.notes.trim(),
              }))
              setEditingEntry(null)
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  )
}

export default App
