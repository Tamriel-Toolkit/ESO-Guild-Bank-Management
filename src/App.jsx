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
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
  const [sessionUser, setSessionUser] = useState(null)
  const [entryDraft, setEntryDraft] = useState(defaultEntryDraft)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authDraft, setAuthDraft] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [newGuildName, setNewGuildName] = useState('')
  const [editingEntry, setEditingEntry] = useState(null)

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

  const stats = statsRows(activeEntries, weekStartDate)

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
          <Box sx={{ flexGrow: 1, p: 3, pr: sessionUser ? 38 : 3 }}>
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
                <Typography variant="h6" gutterBottom>
                  Log Entries
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Notes</TableCell>
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
                      activeEntries.map((entry) => (
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
            <Drawer anchor="right" variant="permanent" PaperProps={{ sx: { width: 320, p: 2 } }}>
              <Toolbar />
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
