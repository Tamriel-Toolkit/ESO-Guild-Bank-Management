import { useEffect, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
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
  Toolbar,
  Typography,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MenuIcon from '@mui/icons-material/Menu'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  confirmPasswordReset,
  createEntryForGuild,
  createGuildInvite,
  createGuild,
  deleteAccount,
  deleteEntryFromGuild,
  deleteGuild,
  getSession,
  importGuestGuild,
  leaveGuild as leaveGuildRequest,
  logIn,
  logOut,
  requestPasswordReset,
  resendVerificationEmail,
  redeemGuildInvite,
  removeGuildMember as removeGuildMemberRequest,
  renameGuild,
  selectGuild,
  signUp,
  updateRecoveryEmail,
  updateEntryInGuild,
  verifyEmailToken,
} from './api'
import AuthDialog from './components/AuthDialog'
import DeleteAccountDialog from './components/DeleteAccountDialog'
import GuildAccessDialog from './components/GuildAccessDialog'
import GuildProfilesDrawer from './components/GuildProfilesDrawer'
import PasswordResetConfirmDialog from './components/PasswordResetConfirmDialog'
import PasswordResetRequestDialog from './components/PasswordResetRequestDialog'
import SettingsDialog from './components/SettingsDialog'
import './App.css'

const LEGACY_STORAGE_KEY = 'eso-guild-bank-management-v1'
const LEGACY_SESSION_USER_KEY = 'eso-guild-bank-session-user'

const todayString = () => new Date().toISOString().slice(0, 10)

const createGuestState = () => ({
  entries: [],
  weekStartDate: todayString(),
})

const normalizeEntry = (entry) => ({
  ...entry,
  isDonation: Boolean(entry?.isDonation),
  user: entry?.user?.trim?.() ?? '',
  notes: entry?.notes?.trim?.() ?? '',
})

const readLegacyState = () => {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    const guestEntries = Array.isArray(parsed?.guest?.entries)
      ? parsed.guest.entries.map(normalizeEntry)
      : []
    const users =
      parsed?.users && typeof parsed.users === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.users).map(([username, user]) => [
              username,
              {
                guilds: Array.isArray(user?.guilds)
                  ? user.guilds.map((guild) => ({
                      id: guild.id,
                      name: guild.name,
                      weekStartDate: guild.weekStartDate || todayString(),
                      entries: Array.isArray(guild?.entries)
                        ? guild.entries.map(normalizeEntry)
                        : [],
                    }))
                  : [],
              },
            ]),
          )
        : {}

    const hasGuestData = guestEntries.length > 0
    const hasUserData = Object.values(users).some((user) => user.guilds.length > 0)
    if (!hasGuestData && !hasUserData) {
      return null
    }

    return {
      guest: {
        entries: guestEntries,
        weekStartDate: parsed?.guest?.weekStartDate || todayString(),
      },
      users,
    }
  } catch {
    return null
  }
}

const createEntry = (draft) => ({
  id: crypto.randomUUID(),
  type: draft.type,
  amount: Number(draft.amount),
  isDonation: draft.type === 'deposit' ? Boolean(draft.isDonation) : false,
  date: draft.date,
  user: draft.user.trim(),
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
  isDonation: false,
  date: todayString(),
  user: '',
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
  user: {
    label: 'User',
    getValue: (entry) => entry.user || '',
  },
}

const guildDrawerWidth = 320

const inviteExpiryOptions = [
  { value: 'never', label: 'Never expires' },
  { value: '1', label: '1 hour' },
  { value: '24', label: '24 hours' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
]

const isoToDay = (isoDate) => new Date(`${isoDate}T00:00:00`)

const dayToIso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const formatDisplayDate = (isoDate) => {
  if (!isoDate) {
    return ''
  }

  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) {
    return isoDate
  }

  return `${month}/${day}/${year}`
}

const formatDisplayDateRange = (startDate, endDate) =>
  startDate === endDate
    ? formatDisplayDate(startDate)
    : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`

const addDays = (date, amount) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const startOfWeek = (date) => addDays(date, -date.getDay())

const endOfWeek = (date) => addDays(startOfWeek(date), 6)

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)

const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)

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

const computeTopDonors = (entries, filter) => {
  const depositsByUser = entries.reduce((totals, entry) => {
    if (!filter(entry) || entry.type !== 'deposit' || !entry.isDonation) {
      return totals
    }

    const username = entry.user?.trim() || 'Unknown user'
    totals.set(username, (totals.get(username) || 0) + (Number(entry.amount) || 0))
    return totals
  }, new Map())

  return [...depositsByUser.entries()]
    .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
    .slice(0, 3)
    .map(([username, amount], index) => ({ rank: index + 1, username, amount }))
}

const fmtGold = (value) => `${Math.round(value).toLocaleString()}g`

const createTodayStatisticsRange = () => ({
  startDate: todayString(),
  endDate: todayString(),
})

const createAllStatisticsRange = (entries) => {
  const entryDates = entries
    .map((entry) => entry.date)
    .filter((date) => typeof date === 'string' && date.length > 0)
    .sort()

  if (entryDates.length === 0) {
    return createTodayStatisticsRange()
  }

  return {
    startDate: entryDates[0],
    endDate: entryDates[entryDates.length - 1],
  }
}

const createCollapsedStatisticsSections = () => ({
  Daily: true,
  Weekly: false,
  Monthly: false,
  Overall: false,
})

const resolveStatisticsRange = (statisticsRange) => {
  const fallbackDate = todayString()
  let startDate = statisticsRange.startDate || statisticsRange.endDate || fallbackDate
  let endDate = statisticsRange.endDate || statisticsRange.startDate || fallbackDate

  if (startDate > endDate) {
    ;[startDate, endDate] = [endDate, startDate]
  }

  return { startDate, endDate }
}

const addStatisticsSection = (rows, section, entries) => {
  rows.push({ section, isSectionHeader: true })
  rows.push(...entries.map((entry) => ({ ...entry, section, isSectionHeader: false })))
}

const buildStatisticsRows = (entries, statisticsRange) => {
  const { startDate, endDate } = resolveStatisticsRange(statisticsRange)
  const rows = []
  const dailyRows = []
  const weeklyRows = []
  const monthlyRows = []
  const startDay = isoToDay(startDate)
  const endDay = isoToDay(endDate)

  for (let day = new Date(startDay); day <= endDay; day = addDays(day, 1)) {
    const dayIso = dayToIso(day)
    dailyRows.push({
      label: formatDisplayDate(dayIso),
      totals: computeTotals(entries, (entry) => entry.date === dayIso),
      topDonors: computeTopDonors(entries, (entry) => entry.date === dayIso),
    })
  }
  dailyRows.reverse()

  for (
    let weekStart = startOfWeek(startDay);
    weekStart <= endDay;
    weekStart = addDays(weekStart, 7)
  ) {
    const weekStartIso = dayToIso(weekStart)
    const weekEndIso = dayToIso(endOfWeek(weekStart))
    weeklyRows.push({
      label: formatDisplayDateRange(weekStartIso, weekEndIso),
      totals: computeTotals(entries, (entry) => entry.date >= weekStartIso && entry.date <= weekEndIso),
      topDonors: computeTopDonors(entries, (entry) => entry.date >= weekStartIso && entry.date <= weekEndIso),
    })
  }
  weeklyRows.reverse()

  for (
    let monthStart = startOfMonth(startDay);
    monthStart <= endDay;
    monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
  ) {
    const monthStartIso = dayToIso(monthStart)
    const monthEndIso = dayToIso(endOfMonth(monthStart))
    monthlyRows.push({
      label: formatDisplayDateRange(monthStartIso, monthEndIso),
      totals: computeTotals(entries, (entry) => entry.date >= monthStartIso && entry.date <= monthEndIso),
      topDonors: computeTopDonors(entries, (entry) => entry.date >= monthStartIso && entry.date <= monthEndIso),
    })
  }
  monthlyRows.reverse()

  addStatisticsSection(rows, 'Overall', [
    {
      label: formatDisplayDateRange(startDate, endDate),
      totals: computeTotals(entries, (entry) => entry.date >= startDate && entry.date <= endDate),
      topDonors: computeTopDonors(entries, (entry) => entry.date >= startDate && entry.date <= endDate),
    },
  ])
  addStatisticsSection(rows, 'Monthly', monthlyRows)
  addStatisticsSection(rows, 'Weekly', weeklyRows)
  addStatisticsSection(rows, 'Daily', dailyRows)

  return rows
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
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('md'))
  const [guestState, setGuestState] = useState(createGuestState)
  const [legacyState, setLegacyState] = useState(readLegacyState)
  const [serverUser, setServerUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [entryDraft, setEntryDraft] = useState(defaultEntryDraft)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authDraft, setAuthDraft] = useState({ username: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInviteCode, setSettingsInviteCode] = useState('')
  const [settingsInviteError, setSettingsInviteError] = useState('')
  const [recoveryEmailDraft, setRecoveryEmailDraft] = useState({ email: '', password: '' })
  const [recoveryEmailError, setRecoveryEmailError] = useState('')
  const [recoveryEmailNotice, setRecoveryEmailNotice] = useState('')
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountDraft, setDeleteAccountDraft] = useState({ password: '' })
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const [guildAccessGuildId, setGuildAccessGuildId] = useState(null)
  const [guildAccessInviteCode, setGuildAccessInviteCode] = useState('')
  const [guildAccessError, setGuildAccessError] = useState('')
  const [guildAccessInviteSingleUse, setGuildAccessInviteSingleUse] = useState(true)
  const [guildAccessInviteExpiry, setGuildAccessInviteExpiry] = useState('never')
  const [globalError, setGlobalError] = useState('')
  const [globalNotice, setGlobalNotice] = useState('')
  const [newGuildName, setNewGuildName] = useState('')
  const [editingEntry, setEditingEntry] = useState(null)
  const [entryPageState, setEntryPageState] = useState({ scope: '', page: 1 })
  const [entriesPerPage, setEntriesPerPage] = useState(entryPageSizeOptions[0])
  const [entrySort, setEntrySort] = useState({ column: 'date', direction: 'desc' })
  const [statisticsRange, setStatisticsRange] = useState(createTodayStatisticsRange)
  const [collapsedStatisticsSections, setCollapsedStatisticsSections] = useState(
    createCollapsedStatisticsSections,
  )
  const [passwordResetRequestOpen, setPasswordResetRequestOpen] = useState(false)
  const [passwordResetRequestEmail, setPasswordResetRequestEmail] = useState('')
  const [passwordResetRequestError, setPasswordResetRequestError] = useState('')
  const [passwordResetRequestNotice, setPasswordResetRequestNotice] = useState('')
  const [passwordResetConfirmOpen, setPasswordResetConfirmOpen] = useState(false)
  const [passwordResetToken, setPasswordResetToken] = useState('')
  const [passwordResetDraft, setPasswordResetDraft] = useState({ password: '', confirmPassword: '' })
  const [passwordResetError, setPasswordResetError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const [guildDrawerOpen, setGuildDrawerOpen] = useState(false)

  const sessionUser = serverUser?.username ?? null
  const currentUser = serverUser
  const selectedGuild =
    currentUser?.guilds?.find((guild) => guild.id === currentUser.selectedGuildId) ?? null
  const guildAccessGuild =
    currentUser?.guilds?.find((guild) => guild.id === guildAccessGuildId) ?? null

  const activeEntries = sessionUser ? selectedGuild?.entries ?? [] : guestState.entries
  const legacyUserGuilds = sessionUser ? legacyState?.users?.[sessionUser]?.guilds ?? [] : []
  const hasLegacyData = Boolean(
    legacyState && (legacyState.guest.entries.length > 0 || legacyUserGuilds.length > 0),
  )

  useEffect(() => {
    let isCancelled = false

    const loadSession = async () => {
      try {
        const response = await getSession()
        if (!isCancelled) {
          setServerUser(response.user)
          setEntryDraft((prev) => ({
            ...prev,
            user: response.user?.username ?? '',
          }))
        }
      } catch (error) {
        if (!isCancelled) {
          setGlobalError(error.message)
        }
      } finally {
        if (!isCancelled) {
          setSessionLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sessionUser || !selectedGuild?.id) {
      return
    }

    setStatisticsRange(createTodayStatisticsRange())
  }, [sessionUser, selectedGuild?.id])

  useEffect(() => {
    if (!settingsOpen) {
      return
    }

    setRecoveryEmailDraft({ email: currentUser?.email ?? '', password: '' })
    setRecoveryEmailError('')
    setRecoveryEmailNotice('')
  }, [currentUser?.email, settingsOpen])

  useEffect(() => {
    if (!guildAccessGuildId) {
      return
    }

    if (!guildAccessGuild) {
      setGuildAccessGuildId(null)
      setGuildAccessInviteCode('')
      setGuildAccessError('')
    }
  }, [guildAccessGuild, guildAccessGuildId])

  useEffect(() => {
    if (!sessionUser || !guildAccessGuild?.isOwner) {
      return undefined
    }

    const refreshOwnerGuildAccess = async () => {
      try {
        const response = await getSession()
        setServerUser(response.user)
      } catch {
        // Keep the current dialog state if a background refresh fails.
      }
    }

    const intervalId = window.setInterval(refreshOwnerGuildAccess, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [guildAccessGuild?.id, guildAccessGuild?.isOwner, sessionUser])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('verify-email')
    const resetToken = params.get('reset-password')

    if (!verifyToken && !resetToken) {
      return
    }

    if (verifyToken) {
      params.delete('verify-email')
    }
    if (resetToken) {
      params.delete('reset-password')
    }

    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)

    if (resetToken) {
      setPasswordResetToken(resetToken)
      setPasswordResetDraft({ password: '', confirmPassword: '' })
      setPasswordResetError('')
      setPasswordResetConfirmOpen(true)
      setAuthOpen(false)
    }

    if (verifyToken) {
      ;(async () => {
        try {
          const response = await verifyEmailToken(verifyToken)
          const sessionResponse = await getSession().catch(() => null)
          if (sessionResponse?.user) {
            setServerUser(sessionResponse.user)
          }
          setGlobalError('')
          setGlobalNotice(response.message)
        } catch (error) {
          setGlobalNotice('')
          setGlobalError(error.message)
        }
      })()
    }
  }, [])

  const statisticsRows = buildStatisticsRows(activeEntries, statisticsRange)
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
  const paginationScope = [
    sessionUser ?? 'guest',
    selectedGuild?.id ?? 'noguild',
    entriesPerPage,
    entrySort.column,
    entrySort.direction,
  ].join(':')
  const totalEntryPages = Math.max(1, Math.ceil(sortedEntries.length / entriesPerPage))
  const entryPage =
    entryPageState.scope === paginationScope
      ? Math.min(entryPageState.page, totalEntryPages)
      : 1
  const visibleEntries = sortedEntries.slice(
    (entryPage - 1) * entriesPerPage,
    entryPage * entriesPerPage,
  )

  const clearMessages = () => {
    setGlobalError('')
    setGlobalNotice('')
  }

  const handleEntrySort = (column) => {
    setEntrySort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleApiError = (error) => {
    setGlobalError(error.message)
    setGlobalNotice('')
  }

  const closeSettings = (force = false) => {
    if (mutationPending && !force) {
      return
    }

    setSettingsOpen(false)
    setSettingsInviteCode('')
    setSettingsInviteError('')
    setRecoveryEmailError('')
    setRecoveryEmailNotice('')
  }

  const closePasswordResetRequest = (force = false) => {
    if (mutationPending && !force) {
      return
    }

    setPasswordResetRequestOpen(false)
    setPasswordResetRequestEmail(currentUser?.email ?? '')
    setPasswordResetRequestError('')
    setPasswordResetRequestNotice('')
  }

  const closePasswordResetConfirm = (force = false) => {
    if (mutationPending && !force) {
      return
    }

    setPasswordResetConfirmOpen(false)
    setPasswordResetToken('')
    setPasswordResetDraft({ password: '', confirmPassword: '' })
    setPasswordResetError('')
  }

  const closeGuildAccess = (force = false) => {
    if (mutationPending && !force) {
      return
    }

    setGuildAccessGuildId(null)
    setGuildAccessInviteCode('')
    setGuildAccessError('')
    setGuildAccessInviteSingleUse(true)
    setGuildAccessInviteExpiry('never')
  }

  const persistAuthenticatedUser = (user, notice = '') => {
    setServerUser(user)
    setGlobalError('')
    setGlobalNotice(notice)
  }

  const maybeImportGuestEntries = async (user) => {
    if (guestState.entries.length === 0) {
      return user
    }

    const hasAccountData = user.guilds.some((guild) => guild.entries.length > 0)
    let shouldImport = !hasAccountData

    if (hasAccountData) {
      shouldImport = window.confirm(
        'This account already has data. Save your current guest page as a new guild profile?',
      )
    }

    if (!shouldImport) {
      return user
    }

    const importedGuildName = hasAccountData
      ? `Imported Guest Guild ${user.guilds.length + 1}`
      : 'Imported Guest Guild'
    const response = await importGuestGuild({
      name: importedGuildName,
      weekStartDate: guestState.weekStartDate,
      entries: guestState.entries,
    })

    setGuestState(createGuestState())
    return response.user
  }

  const saveEntry = async () => {
    if (!entryDraft.amount || Number(entryDraft.amount) <= 0 || !entryDraft.date) {
      return
    }

    clearMessages()

    if (!sessionUser) {
      const nextEntry = createEntry(entryDraft)
      setGuestState((prev) => ({
        ...prev,
        entries: [nextEntry, ...prev.entries],
      }))
      setEntryDraft({ ...defaultEntryDraft, date: todayString(), user: '' })
      setGlobalNotice('Guest entry added. Create an account to store data on the server.')
      return
    }

    if (!selectedGuild) {
      return
    }

    setMutationPending(true)
    try {
      const response = await createEntryForGuild(selectedGuild.id, entryDraft)
      persistAuthenticatedUser(response.user, 'Entry saved securely.')
      setEntryDraft({ ...defaultEntryDraft, date: todayString(), user: sessionUser ?? '' })
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const updateEntry = async (entryId, updater) => {
    if (!sessionUser) {
      setGuestState((prev) => ({
        ...prev,
        entries: prev.entries.map((entry) =>
          entry.id === entryId ? normalizeEntry(updater(entry)) : entry,
        ),
      }))
      return true
    }

    if (!selectedGuild) {
      return false
    }

    const existingEntry = selectedGuild.entries.find((entry) => entry.id === entryId)
    if (!existingEntry) {
      return false
    }

    setMutationPending(true)
    try {
      const response = await updateEntryInGuild(selectedGuild.id, entryId, updater(existingEntry))
      persistAuthenticatedUser(response.user, 'Entry updated securely.')
      return true
    } catch (error) {
      handleApiError(error)
      return false
    } finally {
      setMutationPending(false)
    }
  }

  const deleteEntry = async (entryId) => {
    clearMessages()

    if (!sessionUser) {
      setGuestState((prev) => ({
        ...prev,
        entries: prev.entries.filter((entry) => entry.id !== entryId),
      }))
      return
    }

    if (!selectedGuild) {
      return
    }

    setMutationPending(true)
    try {
      const response = await deleteEntryFromGuild(selectedGuild.id, entryId)
      persistAuthenticatedUser(response.user, 'Entry removed.')
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleAuth = async () => {
    const username = authDraft.username.trim().toLowerCase()
    const email = authDraft.email.trim().toLowerCase()
    const password = authDraft.password

    if (!username || !password || (authMode === 'signup' && !email)) {
      setAuthError(
        authMode === 'signup'
          ? 'Enter a username, recovery email, and password.'
          : 'Enter both a username and password.',
      )
      return
    }

    setAuthSubmitting(true)
    setAuthError('')
    clearMessages()

    try {
      const response = authMode === 'signup'
        ? await signUp({ username, email, password })
        : await logIn({ username, password })
      let nextUser = response.user

      nextUser = await maybeImportGuestEntries(nextUser)
      setServerUser(nextUser)
      setEntryDraft((prev) => ({
        ...prev,
        user: nextUser.username,
      }))
      setAuthOpen(false)
      setAuthDraft({ username: '', email: '', password: '' })
      setGlobalNotice(
        response.notice || (authMode === 'signup'
          ? 'Account created. Your data is now stored on the server.'
          : 'Logged in successfully.'),
      )
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = async () => {
    clearMessages()
    setMutationPending(true)

    try {
      await logOut()
      setServerUser(null)
      setEntryDraft((prev) => ({
        ...prev,
        user: '',
      }))
      setGlobalNotice('Logged out.')
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteAccountDraft.password) {
      setDeleteAccountError('Enter your password to confirm account deletion.')
      return
    }

    clearMessages()
    setDeleteAccountError('')
    setMutationPending(true)

    try {
      await deleteAccount({ password: deleteAccountDraft.password })
      setServerUser(null)
      setDeleteAccountOpen(false)
      setDeleteAccountDraft({ password: '' })
      setEntryDraft((prev) => ({
        ...prev,
        user: '',
      }))
      setGlobalNotice('Account deleted.')
    } catch (error) {
      setDeleteAccountError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleOpenDeleteAccountFromSettings = () => {
    setSettingsOpen(false)
    setDeleteAccountOpen(true)
  }

  const openPasswordResetRequest = () => {
    setAuthOpen(false)
    setPasswordResetRequestOpen(true)
    setPasswordResetRequestEmail(currentUser?.email ?? '')
    setPasswordResetRequestError('')
    setPasswordResetRequestNotice('')
  }

  const handleRequestPasswordReset = async () => {
    if (!passwordResetRequestEmail.trim()) {
      setPasswordResetRequestError('Enter your recovery email address.')
      return
    }

    clearMessages()
    setPasswordResetRequestError('')
    setPasswordResetRequestNotice('')
    setMutationPending(true)

    try {
      const response = await requestPasswordReset(passwordResetRequestEmail.trim().toLowerCase())
      setPasswordResetRequestNotice(response.message)
    } catch (error) {
      setPasswordResetRequestError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleConfirmPasswordReset = async () => {
    if (!passwordResetDraft.password || !passwordResetDraft.confirmPassword) {
      setPasswordResetError('Enter and confirm your new password.')
      return
    }

    if (passwordResetDraft.password !== passwordResetDraft.confirmPassword) {
      setPasswordResetError('The new passwords do not match.')
      return
    }

    clearMessages()
    setPasswordResetError('')
    setMutationPending(true)

    try {
      const response = await confirmPasswordReset(passwordResetToken, passwordResetDraft.password)
      closePasswordResetConfirm(true)
      setAuthOpen(true)
      setAuthMode('login')
      setGlobalNotice(response.message)
    } catch (error) {
      setPasswordResetError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleResendVerificationEmail = async () => {
    clearMessages()
    setRecoveryEmailError('')
    setRecoveryEmailNotice('')
    setMutationPending(true)

    try {
      const response = await resendVerificationEmail()
      setRecoveryEmailNotice(response.message)
    } catch (error) {
      setRecoveryEmailError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleUpdateRecoveryEmail = async () => {
    if (!recoveryEmailDraft.email.trim() || !recoveryEmailDraft.password) {
      setRecoveryEmailError('Enter your recovery email and current password.')
      return
    }

    clearMessages()
    setRecoveryEmailError('')
    setRecoveryEmailNotice('')
    setMutationPending(true)

    try {
      const response = await updateRecoveryEmail({
        email: recoveryEmailDraft.email.trim().toLowerCase(),
        password: recoveryEmailDraft.password,
      })
      setServerUser(response.user)
      setRecoveryEmailDraft((prev) => ({ ...prev, password: '' }))
      setRecoveryEmailNotice(response.message)
      setGlobalNotice(response.message)
    } catch (error) {
      setRecoveryEmailError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleOpenGuildAccess = (guildId) => {
    setGuildAccessGuildId(guildId)
    setGuildAccessInviteCode('')
    setGuildAccessError('')
    setGuildAccessInviteSingleUse(true)
    setGuildAccessInviteExpiry('never')
  }

  const handleCreateGuildInvite = async () => {
    if (!guildAccessGuild?.isOwner) {
      return
    }

    clearMessages()
    setGuildAccessError('')
    setMutationPending(true)

    try {
      const response = await createGuildInvite(guildAccessGuild.id, {
        singleUse: guildAccessInviteSingleUse,
        expiresInHours: guildAccessInviteExpiry === 'never' ? null : Number(guildAccessInviteExpiry),
      })
      setGuildAccessInviteCode(response.code)
      setGlobalNotice(`Invite code created for ${guildAccessGuild.name}.`)
    } catch (error) {
      setGuildAccessError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleRedeemInviteCode = async () => {
    if (!settingsInviteCode.trim()) {
      setSettingsInviteError('Enter an invite code.')
      return
    }

    clearMessages()
    setSettingsInviteError('')
    setMutationPending(true)

    try {
      const response = await redeemGuildInvite(settingsInviteCode)
      persistAuthenticatedUser(response.user, 'Invite accepted. You can now edit that guild.')
      closeSettings(true)
    } catch (error) {
      setSettingsInviteError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleRemoveGuildMember = async (guild, member) => {
    if (!guild?.isOwner || member.isOwner) {
      return
    }

    if (!window.confirm(`Remove ${member.username} from ${guild.name}?`)) {
      return
    }

    clearMessages()
    setGuildAccessError('')
    setMutationPending(true)

    try {
      const response = await removeGuildMemberRequest(guild.id, member.userId)
      persistAuthenticatedUser(response.user, `${member.username} was removed from ${guild.name}.`)
    } catch (error) {
      setGuildAccessError(error.message)
    } finally {
      setMutationPending(false)
    }
  }

  const handleLeaveGuild = async (guild) => {
    if (!guild || guild.isOwner) {
      return
    }

    if (!window.confirm(`Leave ${guild.name}? You will lose access to its entries unless invited again.`)) {
      return
    }

    clearMessages()
    setMutationPending(true)

    try {
      const response = await leaveGuildRequest(guild.id)
      persistAuthenticatedUser(response.user, `You left ${guild.name}.`)
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleCreateGuild = async () => {
    if (!newGuildName.trim()) {
      return
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await createGuild({ name: newGuildName.trim(), weekStartDate: todayString() })
      persistAuthenticatedUser(response.user, 'Guild created securely.')
      setNewGuildName('')
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleRenameGuild = async (guildId, currentName) => {
    const nextName = window.prompt('Guild name', currentName)
    if (!nextName?.trim()) {
      return
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await renameGuild(guildId, nextName.trim())
      persistAuthenticatedUser(response.user, 'Guild renamed.')
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleDeleteGuild = async (guildId) => {
    if (!window.confirm('Delete this guild profile and all of its entries?')) {
      return
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await deleteGuild(guildId)
      persistAuthenticatedUser(response.user, 'Guild deleted.')
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleSelectGuild = async (guildId) => {
    if (!sessionUser || guildId === currentUser?.selectedGuildId) {
      return
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await selectGuild(guildId)
      persistAuthenticatedUser(response.user)
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const handleStatisticsRangeChange = (field, value) => {
    setStatisticsRange((prev) => {
      const nextRange = {
        ...prev,
        [field]: value,
      }

      if (nextRange.startDate && nextRange.endDate && nextRange.startDate > nextRange.endDate) {
        if (field === 'startDate') {
          nextRange.endDate = value
        } else {
          nextRange.startDate = value
        }
      }

      return nextRange
    })
  }

  const toggleStatisticsSection = (section) => {
    setCollapsedStatisticsSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleLegacyImport = async () => {
    if (!sessionUser || !legacyState) {
      return
    }

    const legacyImports = []
    if (legacyState.guest.entries.length > 0) {
      legacyImports.push({
        name: 'Legacy Guest Guild',
        weekStartDate: legacyState.guest.weekStartDate,
        entries: legacyState.guest.entries,
      })
    }

    for (const guild of legacyUserGuilds) {
      legacyImports.push({
        name: guild.name,
        weekStartDate: guild.weekStartDate,
        entries: guild.entries,
      })
    }

    if (legacyImports.length === 0) {
      return
    }

    clearMessages()
    setMutationPending(true)
    try {
      let nextUser = serverUser
      for (const guild of legacyImports) {
        const response = await importGuestGuild(guild)
        nextUser = response.user
      }

      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_SESSION_USER_KEY)
      setLegacyState(null)
      persistAuthenticatedUser(nextUser, 'Legacy browser data imported to the server.')
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="eso-bg" sx={{ minHeight: '100vh', pb: 6 }}>
        <AppBar position="static" color="transparent" sx={{ backdropFilter: 'blur(4px)' }}>
          <Toolbar sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1, minWidth: 0 }}>
              <Box
                component="img"
                src="/eso-coin-favicon.svg"
                alt="ESO Guild Gold Ledger coin"
                sx={{ width: 26, height: 26, flexShrink: 0 }}
              />
              <Typography variant="h6" sx={{ minWidth: 0, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                ESO Guild Gold Ledger
              </Typography>
            </Box>
            {sessionUser ? (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
                justifyContent="flex-end"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {isMobileLayout && (
                  <IconButton
                    color="inherit"
                    onClick={() => setGuildDrawerOpen(true)}
                    disabled={mutationPending}
                    aria-label="Open guild profiles"
                  >
                    <MenuIcon />
                  </IconButton>
                )}
                <Chip
                  label={`Logged in: ${sessionUser}`}
                  color="primary"
                  size="small"
                  sx={{ maxWidth: { xs: '100%', sm: 280 } }}
                />
                <IconButton color="inherit" onClick={() => setSettingsOpen(true)} disabled={mutationPending}>
                  <SettingsIcon />
                </IconButton>
                <Button color="inherit" onClick={handleLogout} disabled={mutationPending}>
                  Log out
                </Button>
              </Stack>
            ) : (
              <Button color="inherit" onClick={() => setAuthOpen(true)} disabled={sessionLoading}>
                Sign up / Log in
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ display: 'flex' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
            <Typography variant="h4" gutterBottom>
              Track Guild Gold Flow
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              Log deposits, withdrawals, and sales tax income with editable notes.
            </Typography>

            <Stack spacing={2} sx={{ mb: 3 }}>
              {sessionLoading && <Alert severity="info">Restoring your secure session...</Alert>}
              {globalError && (
                <Alert severity="error" onClose={() => setGlobalError('')}>
                  {globalError}
                </Alert>
              )}
              {globalNotice && (
                <Alert severity="success" onClose={() => setGlobalNotice('')}>
                  {globalNotice}
                </Alert>
              )}
              {hasLegacyData && sessionUser && (
                <Alert
                  severity="info"
                  action={
                    <Button color="inherit" size="small" onClick={handleLegacyImport}>
                      Import now
                    </Button>
                  }
                >
                  Legacy browser data was detected for this account. Import it into the secure server.
                </Alert>
              )}
              {legacyState && !sessionUser && !sessionLoading && (
                <Alert severity="info">
                  Legacy browser data was detected. Sign in to import it into the secure server.
                </Alert>
              )}
              {sessionUser && !sessionLoading && !currentUser?.email && (
                <Alert
                  severity="warning"
                  action={
                    <Button color="inherit" size="small" onClick={() => setSettingsOpen(true)}>
                      Add email
                    </Button>
                  }
                >
                  Add a verified recovery email in settings so password resets are possible.
                </Alert>
              )}
              {sessionUser && !sessionLoading && currentUser?.email && !currentUser.emailVerified && (
                <Alert
                  severity="info"
                  action={
                    <Button color="inherit" size="small" onClick={handleResendVerificationEmail}>
                      Resend verification
                    </Button>
                  }
                >
                  Verify {currentUser.email} to finish enabling password recovery.
                </Alert>
              )}
              {!sessionUser && !sessionLoading && (
                <Alert severity="warning">
                  Guest mode is temporary. Create an account to store data on the server for publication.
                </Alert>
              )}
            </Stack>

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
                          setEntryDraft((prev) => ({
                            ...prev,
                            type: event.target.value,
                            isDonation: event.target.value === 'deposit' ? prev.isDonation : false,
                          }))
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
                      label="User"
                      value={entryDraft.user}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, user: event.target.value }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Optional Notes"
                      value={entryDraft.notes}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, notes: event.target.value }))
                      }
                    />
                    {entryDraft.type === 'deposit' && (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={entryDraft.isDonation}
                            onChange={(event) =>
                              setEntryDraft((prev) => ({ ...prev, isDonation: event.target.checked }))
                            }
                          />
                        }
                        label="Donation"
                      />
                    )}
                    <Button variant="contained" onClick={saveEntry} disabled={mutationPending}>
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
                  <Typography variant="h6">Statistics</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <TextField
                      type="date"
                      value={statisticsRange.startDate}
                      onChange={(event) => handleStatisticsRangeChange('startDate', event.target.value)}
                      inputProps={{ 'aria-label': 'Start date' }}
                      sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 170 } }}
                    />
                    <Typography variant="body1">&ndash;</Typography>
                    <TextField
                      type="date"
                      value={statisticsRange.endDate}
                      onChange={(event) => handleStatisticsRangeChange('endDate', event.target.value)}
                      inputProps={{ 'aria-label': 'End date' }}
                      sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 170 } }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => setStatisticsRange(createAllStatisticsRange(activeEntries))}
                    >
                      All
                    </Button>
                    <Button variant="outlined" onClick={() => setStatisticsRange(createTodayStatisticsRange())}>
                      Today
                    </Button>
                  </Stack>
                </Stack>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 560 }}>
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
                      {statisticsRows.map((statisticsRow) => {
                        if (statisticsRow.isSectionHeader) {
                          return (
                            <TableRow key={statisticsRow.section}>
                              <TableCell colSpan={5} sx={{ fontWeight: 700, pt: 2, pb: 1 }}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{ cursor: 'pointer' }}
                                  onClick={() => toggleStatisticsSection(statisticsRow.section)}
                                >
                                  <IconButton size="small" aria-label={`Toggle ${statisticsRow.section}`}>
                                    {collapsedStatisticsSections[statisticsRow.section] ? (
                                      <ExpandMoreIcon fontSize="small" />
                                    ) : (
                                      <ExpandLessIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {statisticsRow.section}
                                  </Typography>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          )
                        }

                        if (collapsedStatisticsSections[statisticsRow.section]) {
                          return null
                        }

                        const grandTotal =
                          statisticsRow.totals.deposit +
                          statisticsRow.totals.salesTax -
                          statisticsRow.totals.withdrawal

                        return (
                          <TableRow key={`${statisticsRow.section}-${statisticsRow.label}`}>
                            <TableCell>
                              <Stack spacing={0.25}>
                                <Typography variant="body2">{statisticsRow.label}</Typography>
                                {statisticsRow.topDonors?.length ? (
                                  statisticsRow.topDonors.map((donor) => (
                                    <Typography key={`${statisticsRow.label}-${donor.rank}-${donor.username}`} variant="caption" color="text.secondary">
                                      {`#${donor.rank} donor: ${donor.username} (${fmtGold(donor.amount)})`}
                                    </Typography>
                                  ))
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    Top donors: No donation deposits recorded
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell align="right">{fmtGold(statisticsRow.totals.deposit)}</TableCell>
                            <TableCell align="right">{fmtGold(statisticsRow.totals.withdrawal)}</TableCell>
                            <TableCell align="right">{fmtGold(statisticsRow.totals.salesTax)}</TableCell>
                            <TableCell align="right" sx={grandTotal < 0 ? { color: 'error.main' } : undefined}>
                              {fmtGold(grandTotal)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
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
                      onChange={(_event, value) =>
                        setEntryPageState({ scope: paginationScope, page: value })
                      }
                      size="small"
                      showFirstButton
                      showLastButton
                      siblingCount={0}
                      boundaryCount={1}
                    />
                  </Stack>
                  <FormControl size="small" sx={{ minWidth: 150, alignSelf: { xs: 'stretch', md: 'auto' } }}>
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
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 720 }}>
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
                        <TableCell sortDirection={entrySort.column === 'user' ? entrySort.direction : false}>
                          <TableSortLabel
                            active={entrySort.column === 'user'}
                            direction={entrySort.column === 'user' ? entrySort.direction : 'asc'}
                            onClick={() => handleEntrySort('user')}
                          >
                            User
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
                          <TableCell colSpan={6} align="center">
                            No entries yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                            <TableCell>
                              <Stack spacing={0.25}>
                                <Typography variant="body2">
                                  {entryTypes.find((entryType) => entryType.value === entry.type)?.label}
                                </Typography>
                                {entry.type === 'deposit' && entry.isDonation && (
                                  <Typography variant="caption" color="text.secondary">
                                    Donation
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>{entry.user || '—'}</TableCell>
                            <TableCell align="right">{fmtGold(entry.amount)}</TableCell>
                            <TableCell>{entry.notes || '—'}</TableCell>
                            <TableCell align="right">
                              <IconButton onClick={() => setEditingEntry({ ...entry })}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => deleteEntry(entry.id)} disabled={mutationPending}>
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>

          {sessionUser && (
            <GuildProfilesDrawer
              currentUser={currentUser}
              guildDrawerWidth={guildDrawerWidth}
              newGuildName={newGuildName}
              setNewGuildName={setNewGuildName}
              settingsInviteError={settingsInviteError}
              settingsInviteCode={settingsInviteCode}
              setSettingsInviteCode={setSettingsInviteCode}
              handleCreateGuild={handleCreateGuild}
              handleRedeemInviteCode={handleRedeemInviteCode}
              mutationPending={mutationPending}
              handleOpenGuildAccess={handleOpenGuildAccess}
              handleRenameGuild={handleRenameGuild}
              handleDeleteGuild={handleDeleteGuild}
              handleLeaveGuild={handleLeaveGuild}
              handleSelectGuild={handleSelectGuild}
              isMobileLayout={isMobileLayout}
              guildDrawerOpen={guildDrawerOpen}
              setGuildDrawerOpen={setGuildDrawerOpen}
            />
          )}

          {sessionUser && !isMobileLayout && <Box sx={{ width: guildDrawerWidth, flexShrink: 0 }} />}
        </Box>
      </Box>

      <AuthDialog
        authOpen={authOpen}
        setAuthOpen={setAuthOpen}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        authDraft={authDraft}
        setAuthDraft={setAuthDraft}
        authSubmitting={authSubmitting}
        handleAuth={handleAuth}
        openPasswordResetRequest={openPasswordResetRequest}
      />

      <SettingsDialog
        currentUser={currentUser}
        settingsOpen={settingsOpen}
        closeSettings={closeSettings}
        mutationPending={mutationPending}
        settingsInviteError={settingsInviteError}
        settingsInviteCode={settingsInviteCode}
        setSettingsInviteCode={setSettingsInviteCode}
        handleRedeemInviteCode={handleRedeemInviteCode}
        recoveryEmailDraft={recoveryEmailDraft}
        setRecoveryEmailDraft={setRecoveryEmailDraft}
        recoveryEmailError={recoveryEmailError}
        recoveryEmailNotice={recoveryEmailNotice}
        handleUpdateRecoveryEmail={handleUpdateRecoveryEmail}
        handleResendVerificationEmail={handleResendVerificationEmail}
        handleOpenDeleteAccountFromSettings={handleOpenDeleteAccountFromSettings}
      />

      <PasswordResetRequestDialog
        open={passwordResetRequestOpen}
        onClose={closePasswordResetRequest}
        passwordResetRequestEmail={passwordResetRequestEmail}
        setPasswordResetRequestEmail={setPasswordResetRequestEmail}
        passwordResetRequestError={passwordResetRequestError}
        passwordResetRequestNotice={passwordResetRequestNotice}
        mutationPending={mutationPending}
        handleRequestPasswordReset={handleRequestPasswordReset}
      />

      <PasswordResetConfirmDialog
        open={passwordResetConfirmOpen}
        onClose={closePasswordResetConfirm}
        passwordResetDraft={passwordResetDraft}
        setPasswordResetDraft={setPasswordResetDraft}
        passwordResetError={passwordResetError}
        mutationPending={mutationPending}
        handleConfirmPasswordReset={handleConfirmPasswordReset}
      />

      <DeleteAccountDialog
        deleteAccountOpen={deleteAccountOpen}
        mutationPending={mutationPending}
        setDeleteAccountOpen={setDeleteAccountOpen}
        deleteAccountDraft={deleteAccountDraft}
        setDeleteAccountDraft={setDeleteAccountDraft}
        deleteAccountError={deleteAccountError}
        setDeleteAccountError={setDeleteAccountError}
        handleDeleteAccount={handleDeleteAccount}
      />

      <GuildAccessDialog
        guildAccessGuild={guildAccessGuild}
        closeGuildAccess={closeGuildAccess}
        guildAccessError={guildAccessError}
        guildAccessInviteSingleUse={guildAccessInviteSingleUse}
        setGuildAccessInviteSingleUse={setGuildAccessInviteSingleUse}
        guildAccessInviteExpiry={guildAccessInviteExpiry}
        setGuildAccessInviteExpiry={setGuildAccessInviteExpiry}
        inviteExpiryOptions={inviteExpiryOptions}
        handleCreateGuildInvite={handleCreateGuildInvite}
        mutationPending={mutationPending}
        guildAccessInviteCode={guildAccessInviteCode}
        handleRemoveGuildMember={handleRemoveGuildMember}
      />

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
                    setEditingEntry((prev) => ({
                      ...prev,
                      type: event.target.value,
                      isDonation: event.target.value === 'deposit' ? prev.isDonation : false,
                    }))
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
                label="User"
                value={editingEntry.user || ''}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, user: event.target.value }))
                }
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
              {editingEntry.type === 'deposit' && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(editingEntry.isDonation)}
                      onChange={(event) =>
                        setEditingEntry((prev) => ({ ...prev, isDonation: event.target.checked }))
                      }
                    />
                  }
                  label="Donation"
                />
              )}
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
            disabled={mutationPending}
            onClick={async () => {
              if (editingEntry.amount <= 0) {
                return
              }

              const wasUpdated = await updateEntry(editingEntry.id, () => ({
                ...editingEntry,
                user: editingEntry.user.trim(),
                notes: editingEntry.notes.trim(),
              }))

              if (wasUpdated) {
                setEditingEntry(null)
              }
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
