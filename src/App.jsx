import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AppBar,
  Autocomplete,
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Toolbar,
  Divider,
  Typography,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  confirmPasswordReset,
  createGuildRank,
  updateGuildRank,
  deleteGuildRank,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  createEntryForGuild,
  createGuildInvite,
  createGuild,
  createTrackedMemberForGuild as createTrackedMemberRequest,
  deleteAccount,
  deleteEntryFromGuild,
  deleteGuild,
  deleteTrackedMemberFromGuild as deleteTrackedMemberRequest,
  getGuildAuditLogs,
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
  updateGuildMemberRole as updateGuildMemberRoleRequest,
  updateGuildDuesSettings,
  updateRecoveryEmail,
  updateEntryInGuild,
  updateTrackedMemberInGuild as updateTrackedMemberRequest,
  verifyEmailToken,
  deleteCharacterFromMember,
  createCharacterForMember,
  getCharactersForMember,
  deleteSignup,
  updateSignup,
  createSignupForEvent,
  getSignupsForEvent,
  deleteEventFromGuild,
  updateEventInGuild,
  createEventForGuild,
  getEventsForGuild,
  getMyApplications,
  reviewApplication,
  getGuildApplications,
  submitApplication,
  updateGuildRecruitmentSettings,
  getGuildRecruitmentSettings,
  getPublicGuilds,
  getWebhooksForGuild,
  createWebhookForGuild,
  updateWebhookInGuild,
  deleteWebhookFromGuild,
} from './api'
import AuthDialog from './components/AuthDialog'
import AuditLogDialog from './components/AuditLogDialog'
import DeleteAccountDialog from './components/DeleteAccountDialog'
import DuesDashboardPage from './components/DuesDashboardPage'
import GuildAccessDialog from './components/GuildAccessDialog'
import GuildProfilesDrawer from './components/GuildProfilesDrawer'
import MemberManagementPage from './components/MemberManagementPage'
import RecruitmentSettings from './components/RecruitmentSettings'
import PublicGuildProfile from './components/PublicGuildProfile'
import OfficerApplications from './components/OfficerApplications'
import MyApplications from './components/MyApplications'
import GuildDiscoveryPage from './components/GuildDiscoveryPage'
import EventDialog from './components/EventDialog'
import EventDetailView from './components/EventDetailView'
import CalendarPage from './components/CalendarPage'
import PasswordResetConfirmDialog from './components/PasswordResetConfirmDialog'
import PasswordResetRequestDialog from './components/PasswordResetRequestDialog'
import PieBreakdownChart from './components/PieBreakdownChart'
import SettingsDialog from './components/SettingsDialog'
import RankManagementDialog from "./components/RankManagementDialog"
import CharacterManagementDialog from "./components/CharacterManagementDialog"
import Graph from './components/Graph'
import WelcomePage from './components/WelcomePage'
import TutorialOverlay from './components/TutorialOverlay'
import { exportReportBundle, getOverallCurrentGold } from './reportExports'
import { formatDisplayDate } from './utils/dateFormatting'
import { applyLedgerFilters, defaultLedgerFilters, getLedgerSavedViewScope, hasActiveLedgerFilters } from './utils/ledgerFilters'
import { buildMemberManagementSnapshot } from './utils/memberDues'
import './App.css'

const LEGACY_STORAGE_KEY = 'eso-guild-bank-management-v1'
const LEGACY_SESSION_USER_KEY = 'eso-guild-bank-session-user'
const LEDGER_SAVED_VIEWS_STORAGE_KEY = 'eso-ledger-saved-views-v1'

const todayString = () => new Date().toISOString().slice(0, 10)

const createGuestState = () => ({
  entries: [],
  weekStartDate: todayString(),
})

const withdrawalCategoryOptions = [
  { value: 'traderBid', label: 'Trader Bid' },
  { value: 'heraldry', label: 'Heraldry' },
  { value: 'other', label: 'Other' },
]

const normalizeWithdrawalCategory = (value) =>
  withdrawalCategoryOptions.some((option) => option.value === value) ? value : ''

const getWithdrawalCategoryLabel = (value) =>
  withdrawalCategoryOptions.find((option) => option.value === value)?.label ?? ''

const normalizeEntry = (entry) => ({
  ...entry,
  isDonation: Boolean(entry?.isDonation),
  isDue: Boolean(entry?.isDue),
  withdrawalCategory: normalizeWithdrawalCategory(entry?.withdrawalCategory),
  user: entry?.user?.trim?.() ?? '',
  notes: entry?.notes?.trim?.() ?? '',
})

const normalizeTrackedMember = (member) => ({
  ...member,
  name: member?.name?.trim?.() ?? '',
  duesAmount: Number(member?.duesAmount) || 0,
  useDefaultDues: member?.useDefaultDues !== false,
  duesExempt: Boolean(member?.duesExempt),
  isActive: Boolean(member?.isActive),
})

const buildMemberSuggestions = (trackedMembers, entries) => {
  const suggestions = new Set()

  for (const member of trackedMembers ?? []) {
    if (member?.name?.trim()) {
      suggestions.add(member.name.trim())
    }
  }

  for (const entry of entries ?? []) {
    if (entry?.user?.trim()) {
      suggestions.add(entry.user.trim())
    }
  }

  return [...suggestions].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

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
  isDue: draft.type === 'deposit' ? Boolean(draft.isDue) : false,
  withdrawalCategory:
    draft.type === 'withdrawal' ? normalizeWithdrawalCategory(draft.withdrawalCategory) : '',
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
  isDue: false,
  withdrawalCategory: '',
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

const computeEntryCount = (entries, filter) =>
  entries.reduce((count, entry) => (filter(entry) ? count + 1 : count), 0)

const readLedgerSavedViews = () => {
  try {
    const raw = window.localStorage.getItem(LEDGER_SAVED_VIEWS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

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

const createCurrentWeekStatisticsRange = (baseDate = todayString()) => {
  const day = isoToDay(baseDate)

  return {
    startDate: dayToIso(startOfWeek(day)),
    endDate: dayToIso(endOfWeek(day)),
  }
}

const createCurrentMonthStatisticsRange = (baseDate = todayString()) => {
  const day = isoToDay(baseDate)

  return {
    startDate: dayToIso(startOfMonth(day)),
    endDate: dayToIso(endOfMonth(day)),
  }
}

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

const ledgerExportPeriodOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'overall', label: 'Overall' },
]

const createLedgerExportRange = (period, entries) => {
  if (period === 'daily') {
    return createTodayStatisticsRange()
  }

  if (period === 'weekly') {
    return createCurrentWeekStatisticsRange()
  }

  if (period === 'monthly') {
    return createCurrentMonthStatisticsRange()
  }

  return createAllStatisticsRange(entries)
}

const getStatisticsSectionForExportPeriod = (period) => {
  if (period === 'daily') {
    return 'Daily'
  }

  if (period === 'weekly') {
    return 'Weekly'
  }

  if (period === 'monthly') {
    return 'Monthly'
  }

  return 'Overall'
}

const filterStatisticsRowsForExportPeriod = (rows, period) => {
  const section = getStatisticsSectionForExportPeriod(period)

  return rows.filter((row) => row.section === section)
}

const getSupplementalLedgerExportPeriods = (period) => {
  if (period === 'weekly') {
    return ['daily']
  }

  if (period === 'monthly') {
    return ['weekly', 'daily']
  }

  if (period === 'overall') {
    return ['monthly', 'weekly', 'daily']
  }

  return []
}

const buildLedgerExportEntries = (entries, ledgerFilters, range) =>
  applyLedgerFilters(entries, {
    ...ledgerFilters,
    startDate: range.startDate,
    endDate: range.endDate,
  })

const buildLedgerExportBreakdowns = ({ entries, ledgerFilters, selectedPeriod, selectedRange }) => {
  const normalizedSelectedRange = resolveStatisticsRange(selectedRange)
  const selectedEntries = buildLedgerExportEntries(entries, ledgerFilters, normalizedSelectedRange)
  const breakdowns = [
    {
      title: `${getLedgerExportPeriodLabel(selectedPeriod)} breakdown`,
      period: selectedPeriod,
      range: normalizedSelectedRange,
      entries: selectedEntries,
      statisticsRows: filterStatisticsRowsForExportPeriod(
        buildStatisticsRows(selectedEntries, normalizedSelectedRange),
        selectedPeriod,
      ),
    },
  ]

  for (const period of getSupplementalLedgerExportPeriods(selectedPeriod)) {
    const range = resolveStatisticsRange(createLedgerExportRange(period, entries))
    const periodEntries = buildLedgerExportEntries(entries, ledgerFilters, range)

    breakdowns.push({
      title: `Current ${getLedgerExportPeriodLabel(period)} snapshot`,
      period,
      range,
      entries: periodEntries,
      statisticsRows: filterStatisticsRowsForExportPeriod(buildStatisticsRows(periodEntries, range), period),
    })
  }

  return breakdowns
}

const getLedgerExportPeriodLabel = (period) =>
  ledgerExportPeriodOptions.find((option) => option.value === period)?.label ?? 'Overall'

const createCollapsedStatisticsSections = () => ({
  Daily: false,
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
      entryCount: computeEntryCount(entries, (entry) => entry.date === dayIso),
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
      entryCount: computeEntryCount(entries, (entry) => entry.date >= weekStartIso && entry.date <= weekEndIso),
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
      entryCount: computeEntryCount(entries, (entry) => entry.date >= monthStartIso && entry.date <= monthEndIso),
      topDonors: computeTopDonors(entries, (entry) => entry.date >= monthStartIso && entry.date <= monthEndIso),
    })
  }
  monthlyRows.reverse()

  addStatisticsSection(rows, 'Overall', [
    {
      label: formatDisplayDateRange(startDate, endDate),
      totals: computeTotals(entries, (entry) => entry.date >= startDate && entry.date <= endDate),
      entryCount: computeEntryCount(entries, (entry) => entry.date >= startDate && entry.date <= endDate),
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
    primary: { main: '#c7a15d', light: '#e1c88f', dark: '#8f6a30', contrastText: '#140f09' },
    secondary: { main: '#8c6f3b', light: '#b89a62', dark: '#5a4421' },
    background: { default: '#11100e', paper: '#1a1612' },
    text: { primary: '#f0e6d2', secondary: '#c7b79a' },
    divider: 'rgba(199, 161, 93, 0.18)',
    success: { main: '#7ea96c' },
    warning: { main: '#d5a14d' },
    error: { main: '#c96d57' },
  },
  typography: {
    fontFamily: '"Segoe UI", "Trebuchet MS", sans-serif',
    h4: {
      fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
      letterSpacing: 1,
      fontWeight: 700,
    },
    h5: {
      fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
      letterSpacing: 0.6,
      fontWeight: 700,
    },
    h6: {
      fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
      letterSpacing: 0.5,
      fontWeight: 700,
    },
    subtitle1: {
      fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
      fontWeight: 700,
      letterSpacing: 0.35,
    },
    button: {
      letterSpacing: '0.08em',
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          colorScheme: 'dark',
        },
        '::selection': {
          backgroundColor: 'rgba(199, 161, 93, 0.28)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(199, 161, 93, 0.18)',
          background:
            'linear-gradient(180deg, rgba(25, 20, 15, 0.9), rgba(17, 14, 11, 0.72))',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          position: 'relative',
          border: '1px solid rgba(199, 161, 93, 0.16)',
          background:
            'linear-gradient(180deg, rgba(36, 30, 24, 0.96), rgba(25, 21, 17, 0.94))',
          boxShadow:
            'inset 0 1px 0 rgba(255, 236, 196, 0.05), 0 16px 32px rgba(0, 0, 0, 0.22)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: '1px solid rgba(199, 161, 93, 0.18)',
          background:
            'linear-gradient(180deg, rgba(34, 29, 23, 0.98), rgba(21, 18, 14, 0.98))',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.34)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderLeft: '1px solid rgba(199, 161, 93, 0.16)',
          background:
            'linear-gradient(180deg, rgba(31, 26, 21, 0.98), rgba(19, 16, 13, 0.98))',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: '1rem',
        },
        contained: {
          color: '#140f09',
          background: 'linear-gradient(180deg, #d8b87b 0%, #b98a42 100%)',
          boxShadow: '0 10px 18px rgba(0, 0, 0, 0.2)',
        },
        outlined: {
          borderColor: 'rgba(199, 161, 93, 0.3)',
          backgroundColor: 'rgba(199, 161, 93, 0.05)',
        },
        text: {
          color: '#dfc690',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(199, 161, 93, 0.2)',
          backgroundColor: 'rgba(199, 161, 93, 0.08)',
        },
        filledPrimary: {
          color: '#f7edd4',
          textShadow: '0 1px 8px rgba(0, 0, 0, 0.28)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderBottom: '1px solid rgba(199, 161, 93, 0.16)',
        },
        indicator: {
          height: 3,
          borderRadius: 999,
          background: 'linear-gradient(90deg, #7d5b2d, #d9b46f, #7d5b2d)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          color: '#c7b79a',
          fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          '&.Mui-selected': {
            color: '#f0ddb2',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 247, 233, 0.03)',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(199, 161, 93, 0.34)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#c7a15d',
            boxShadow: '0 0 0 3px rgba(199, 161, 93, 0.08)',
          },
        },
        notchedOutline: {
          borderColor: 'rgba(199, 161, 93, 0.18)',
        },
        input: {
          color: '#f0e6d2',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#bfae8e',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: '#c7b79a',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 14,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(180deg, rgba(199, 161, 93, 0.09), rgba(199, 161, 93, 0.03))',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: '#e2cca0',
          fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
          fontWeight: 700,
          letterSpacing: '0.05em',
        },
        body: {
          borderColor: 'rgba(199, 161, 93, 0.08)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(199, 161, 93, 0.14)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&.Mui-selected': {
            backgroundColor: 'rgba(199, 161, 93, 0.14)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#d9c08b',
        },
      },
    },
  },
})

function App() {
  const heroRef = useRef(null)
  const authActionRef = useRef(null)
  const mobileGuildMenuRef = useRef(null)
  const pageTabsRef = useRef(null)
  const addEntryRef = useRef(null)
  const statisticsRef = useRef(null)
  const graphRef = useRef(null)
  const logEntriesRef = useRef(null)
  const duesOverviewRef = useRef(null)
  const duesHistoryRef = useRef(null)
  const memberManagementControlsRef = useRef(null)
  const memberManagementRosterRef = useRef(null)
  const guildDrawerRef = useRef(null)

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
  const [ledgerFilters, setLedgerFilters] = useState(() => ({ ...defaultLedgerFilters }))
  const [savedLedgerViews, setSavedLedgerViews] = useState(readLedgerSavedViews)
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('')
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
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [auditLogOpen, setAuditLogOpen] = useState(false)
  const [auditLogGuild, setAuditLogGuild] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLogLoading, setAuditLogLoading] = useState(false)
  const [auditLogError, setAuditLogError] = useState('')
  const [rankManagementOpen, setRankManagementOpen] = useState(false)
  const [characterManagementOpen, setCharacterManagementOpen] = useState(false)
  const [selectedMemberForCharacters, setSelectedMemberForCharacters] = useState(null)
  const [currentPage, setCurrentPage] = useState('welcome')
  const [discoveryGuildId, setDiscoveryGuildId] = useState(null)
  const [recruitmentTab, setRecruitmentTab] = useState('settings')
  const [webhooks, setWebhooks] = useState([])
  const [webhooksLoading, setWebhooksLoading] = useState(false)
  const [pendingDueSchemeChange, setPendingDueSchemeChange] = useState(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportScope, setExportScope] = useState('ledger')
  const [exportPeriod, setExportPeriod] = useState('overall')
  const [exportRange, setExportRange] = useState(createTodayStatisticsRange)
  const sessionUser = serverUser?.username ?? null
  const currentUser = serverUser
  const selectedGuild =
    currentUser?.guilds?.find((guild) => guild.id === currentUser.selectedGuildId) ?? null
  const guildAccessGuild =
    currentUser?.guilds?.find((guild) => guild.id === guildAccessGuildId) ?? null
  const ledgerSavedViewScope = getLedgerSavedViewScope({ sessionUser, guildId: selectedGuild?.id })
  const scopedSavedLedgerViews = savedLedgerViews[ledgerSavedViewScope] ?? []
  const canEditSelectedGuild = !sessionUser || Boolean(selectedGuild?.canEdit)
  const canManageEventsSelectedGuild = !sessionUser || Boolean(selectedGuild?.canManageEvents)

  const activeEntries = useMemo(
    () => (sessionUser ? selectedGuild?.entries ?? [] : guestState.entries),
    [guestState.entries, selectedGuild?.entries, sessionUser],
  )
  const trackedMembers = useMemo(
    () => (selectedGuild?.trackedMembers ?? []).map(normalizeTrackedMember),
    [selectedGuild?.trackedMembers],
  )
  const memberSuggestions = useMemo(
    () => buildMemberSuggestions(trackedMembers, activeEntries),
    [activeEntries, trackedMembers],
  )
  const filteredEntries = useMemo(
    () =>
      applyLedgerFilters(activeEntries, {
        ...ledgerFilters,
        startDate: statisticsRange.startDate,
        endDate: statisticsRange.endDate,
      }),
    [activeEntries, ledgerFilters, statisticsRange.endDate, statisticsRange.startDate],
  )
  const hasActiveLedgerViewFilters = useMemo(
    () =>
      hasActiveLedgerFilters({
        ...ledgerFilters,
        startDate: statisticsRange.startDate,
        endDate: statisticsRange.endDate,
      }),
    [ledgerFilters, statisticsRange.endDate, statisticsRange.startDate],
  )
  const exportScopeOptions = useMemo(() => {
    const options = [{ value: 'ledger', label: 'Ledger report' }]

    if (sessionUser && selectedGuild) {
      options.push({ value: 'member-management', label: 'Members and dues report' })
      options.push({ value: 'full', label: 'Full combined report' })
    }

    return options
  }, [selectedGuild, sessionUser])
  const exportIncludesLedger = exportScope === 'ledger' || exportScope === 'full'
  const legacyUserGuilds = sessionUser ? legacyState?.users?.[sessionUser]?.guilds ?? [] : []
  const hasLegacyData = Boolean(
    legacyState && (legacyState.guest.entries.length > 0 || legacyUserGuilds.length > 0),
  )

  const tutorialSteps = useMemo(() => {
    const accountStep = sessionUser
      ? {
          title: isMobileLayout ? 'Guild Tools Menu' : 'Guild Profiles',
          body: isMobileLayout
            ? 'Open this menu to switch guilds, create one, join shared guilds, and manage access.'
            : 'Use this sidebar to switch guilds, invite members, and manage shared access.',
          targetRef: isMobileLayout ? mobileGuildMenuRef : guildDrawerRef,
        }
      : {
          title: 'Sign In When You Are Ready',
          body: 'Guest mode is fine for a quick test, but an account saves your data and lets you recover access later.',
          targetRef: authActionRef,
        }

    const pageSpecificSteps =
      currentPage === 'dues'
        ? [
            {
              title: 'Review Shared Dues Settings',
              body: 'Set the guild dues schedule, update the default amount, and review this cycle at a glance.',
              targetRef: duesOverviewRef,
            },
            {
              title: 'Check Payment History',
              body: 'Review recent dues and donations to see who paid and what is still missing.',
              targetRef: duesHistoryRef,
            },
          ]
        : currentPage === 'member-management'
          ? [
              {
                title: 'Add And Update Members',
                body: 'Add members here, rename them, and keep the active roster up to date.',
                targetRef: memberManagementControlsRef,
              },
              {
                title: 'Sort The Directory',
                body: 'Use the roster table to review names, update status, and remove members when needed.',
                targetRef: memberManagementRosterRef,
              },
            ]
          : [
            {
              title: 'Add Entries Quickly',
              body: 'Record deposits, withdrawals, and sales tax here. You can also tag deposits as dues or donations.',
              targetRef: addEntryRef,
            },
            {
              title: 'Read the Totals',
              body: 'The stats table groups your totals by overall, monthly, weekly, and daily activity.',
              targetRef: statisticsRef,
            },
            {
              title: 'Explore the Charts',
              body: 'Use the charts to spot trends and filter the view by date range.',
              targetRef: graphRef,
            },
            {
              title: 'Review the Entry Log',
              body: 'Browse the full log, sort it, and update or remove entries when needed.',
              targetRef: logEntriesRef,
            },
          ]

    return [
      {
        title: 'Welcome to the Guild Ledger',
        body: 'This walkthrough highlights the main tools for tracking gold, reviewing trends, and managing your guild. You can skip it anytime.',
        targetRef: heroRef,
      },
      accountStep,
      ...(sessionUser
        ? [
            {
              title: 'Switch Between Pages',
              body: 'Use these tabs to switch between the ledger, dues, and member roster. The walkthrough follows the page you have open.',
              targetRef: pageTabsRef,
            },
          ]
        : []),
      ...pageSpecificSteps,
    ]
  }, [currentPage, isMobileLayout, sessionUser])

  useEffect(() => {
    let isCancelled = false

    const loadSession = async () => {
      try {
        const response = await getSession()
        if (!isCancelled) {
          setServerUser(response.user)
          setEntryDraft((prev) => ({
            ...prev,
            user: '',
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

  const handleFinishTutorial = () => {
    setTutorialOpen(false)
  }

  const openExportDialog = () => {
    const defaultScope = currentPage !== 'ledger' && sessionUser && selectedGuild ? 'member-management' : 'ledger'
    const defaultPeriod = 'overall'
    setExportScope(defaultScope)
    setExportFormat('csv')
    setExportPeriod(defaultPeriod)
    setExportRange(createLedgerExportRange(defaultPeriod, activeEntries))
    setExportDialogOpen(true)
  }

  useEffect(() => {
    setStatisticsRange(createTodayStatisticsRange())
    setLedgerFilters({ ...defaultLedgerFilters })
    setSelectedSavedViewId('')
    if (selectedGuild) {
      loadWebhooks(selectedGuild.id)
    }
  }, [sessionUser, selectedGuild?.id])

  const loadWebhooks = async (guildId) => {
    setWebhooksLoading(true)
    try {
      const response = await getWebhooksForGuild(guildId)
      setWebhooks(response.webhooks)
    } catch (err) {
      console.error(err)
    } finally {
      setWebhooksLoading(false)
    }
  }

  const handleCreateWebhook = async (draft) => {
    if (!selectedGuild) return
    setMutationPending(true)
    try {
      await createWebhookForGuild(selectedGuild.id, draft)
      await loadWebhooks(selectedGuild.id)
      setGlobalNotice('Webhook added.')
    } catch (err) { handleApiError(err) }
    finally { setMutationPending(false) }
  }

  const handleDeleteWebhook = async (webhookId) => {
    if (!selectedGuild) return
    if (!window.confirm('Remove this webhook?')) return
    setMutationPending(true)
    try {
      await deleteWebhookFromGuild(selectedGuild.id, webhookId)
      await loadWebhooks(selectedGuild.id)
      setGlobalNotice('Webhook removed.')
    } catch (err) { handleApiError(err) }
    finally { setMutationPending(false) }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(LEDGER_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(savedLedgerViews))
    } catch {
      // Ignore storage errors and keep the current session state in memory.
    }
  }, [savedLedgerViews])

  useEffect(() => {
    if (sessionUser && currentPage === 'welcome') {
      setCurrentPage('ledger')
    }
  }, [currentPage, sessionUser])

  useEffect(() => {
    if (!sessionUser && !['welcome', 'ledger', 'discovery'].includes(currentPage)) {
      setCurrentPage('welcome')
    }
  }, [currentPage, sessionUser])

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

  const statisticsRows = buildStatisticsRows(filteredEntries, statisticsRange)
  const sortedEntries = [...filteredEntries].sort((leftEntry, rightEntry) => {
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
    JSON.stringify(ledgerFilters),
    statisticsRange.startDate,
    statisticsRange.endDate,
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

  const showViewOnlyGuildError = () => {
    setGlobalError('You have viewer access to this guild. Ask the owner to promote you to admin before making changes.')
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

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
      return
    }

    setMutationPending(true)
    try {
      const response = await createEntryForGuild(selectedGuild.id, entryDraft)
      persistAuthenticatedUser(response.user, 'Entry saved securely.')
      setEntryDraft({ ...defaultEntryDraft, date: todayString(), user: '' })
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

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
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

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
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
    const shouldOpenTutorial = authMode === 'signup'

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
        user: '',
      }))
      setAuthOpen(false)
      setAuthDraft({ username: '', email: '', password: '' })
      setGlobalNotice(
        response.notice || (authMode === 'signup'
          ? 'Account created. Your data is now stored on the server.'
          : 'Logged in successfully.'),
      )
      if (shouldOpenTutorial) {
        setTutorialOpen(true)
      }
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

  const handleOpenAuditLog = async (guild) => {
    if (!guild?.id) {
      return
    }

    setAuditLogGuild({ id: guild.id, name: guild.name })
    setAuditLogOpen(true)
    setAuditLogs([])
    setAuditLogError('')
    setAuditLogLoading(true)

    try {
      const response = await getGuildAuditLogs(guild.id)
      setAuditLogs(response.auditLogs ?? [])
    } catch (error) {
      setAuditLogError(error.message)
    } finally {
      setAuditLogLoading(false)
    }
  }

  const handleCloseAuditLog = () => {
    if (auditLogLoading) {
      return
    }

    setAuditLogOpen(false)
    setAuditLogGuild(null)
    setAuditLogs([])
    setAuditLogError('')
  }

  const handleCreateGuildInvite = async () => {
    if (!guildAccessGuild?.canManagePermissions) {
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
    if (!guild?.canManagePermissions || member.isOwner) {
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

  const handleUpdateGuildMemberRole = async (guild, member, role) => {
    if (!guild?.canManagePermissions || member.isOwner || member.role === role) {
      return
    }

    clearMessages()
    setGuildAccessError('')
    setMutationPending(true)

    try {
      const response = await updateGuildMemberRoleRequest(guild.id, member.userId, role)
      persistAuthenticatedUser(response.user, `${member.username} is now a ${role}.`)
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
    const guild = currentUser?.guilds?.find((candidateGuild) => candidateGuild.id === guildId)
    if (!guild?.canEdit) {
      showViewOnlyGuildError()
      return
    }

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
    const guild = currentUser?.guilds?.find((candidateGuild) => candidateGuild.id === guildId)
    if (!guild?.canDelete) {
      showViewOnlyGuildError()
      return
    }

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

  const handleCreateTrackedMember = async (draft) => {
    if (!selectedGuild || !sessionUser) {
      return false
    }

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
      return false
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await createTrackedMemberRequest(selectedGuild.id, draft)
      persistAuthenticatedUser(response.user, 'Guild member added to the roster.')
      return true
    } catch (error) {
      handleApiError(error)
      return false
    } finally {
      setMutationPending(false)
    }
  }

  const handleUpdateTrackedMember = async (trackedMemberId, draft) => {
    if (!selectedGuild || !sessionUser) {
      return false
    }

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
      return false
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await updateTrackedMemberRequest(selectedGuild.id, trackedMemberId, draft)
      persistAuthenticatedUser(response.user, 'Guild member updated.')
      return true
    } catch (error) {
      handleApiError(error)
      return false
    } finally {
      setMutationPending(false)
    }
  }

  const handleDeleteTrackedMember = async (trackedMember) => {
    if (!selectedGuild || !sessionUser || !trackedMember) {
      return
    }

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
      return
    }

    if (!window.confirm(`Delete ${trackedMember.name} from the tracked member roster?`)) {
      return
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await deleteTrackedMemberRequest(selectedGuild.id, trackedMember.id)
      persistAuthenticatedUser(response.user, `${trackedMember.name} was removed from the tracked member roster.`)
    } catch (error) {
      handleApiError(error)
    } finally {
      setMutationPending(false)
    }
  }

  const applyGuildDueSettings = async (guildId, settings) => {
    const guild = currentUser?.guilds?.find((candidateGuild) => candidateGuild.id === guildId)
    if (!guild?.canEdit) {
      showViewOnlyGuildError()
      return false
    }

    clearMessages()
    setMutationPending(true)
    try {
      const response = await updateGuildDuesSettings(guildId, settings)
      persistAuthenticatedUser(response.user, 'Guild dues settings updated.')
      return true
    } catch (error) {
      handleApiError(error)
      return false
    } finally {
      setMutationPending(false)
    }
  }

  const handleConfirmDueSchemeChange = async () => {
    if (!pendingDueSchemeChange) {
      return
    }

    const { guildId, settings } = pendingDueSchemeChange
    setPendingDueSchemeChange(null)
    await applyGuildDueSettings(guildId, settings)
  }

  const handleUpdateGuildDueSettings = async (settings) => {
    if (!selectedGuild || !sessionUser) {
      return false
    }

    if (!selectedGuild.canEdit) {
      showViewOnlyGuildError()
      return false
    }

    const nextDueScheme = settings?.dueScheme
    if (
      nextDueScheme &&
      nextDueScheme !== selectedGuild.dueScheme
    ) {
      setPendingDueSchemeChange({
        guildId: selectedGuild.id,
        guildName: selectedGuild.name,
        currentDueScheme: selectedGuild.dueScheme,
        nextDueScheme,
        settings,
      })
      return false
    }

    return applyGuildDueSettings(selectedGuild.id, settings)
  }

  const handleLedgerFilterChange = (field, value) => {
    setSelectedSavedViewId('')
    setLedgerFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const clearLedgerFilters = () => {
    setSelectedSavedViewId('')
    setLedgerFilters({ ...defaultLedgerFilters })
    setStatisticsRange(createTodayStatisticsRange())
  }

  const handleSaveLedgerView = () => {
    const proposedName = window.prompt('Saved view name', scopedSavedLedgerViews.find((view) => view.id === selectedSavedViewId)?.name || '')
    const trimmedName = proposedName?.trim()
    if (!trimmedName) {
      return
    }

    let nextSelectedViewId = selectedSavedViewId
    setSavedLedgerViews((prev) => {
      const scopeViews = prev[ledgerSavedViewScope] ?? []
      const existingView = scopeViews.find(
        (view) => view.id === selectedSavedViewId || view.name.toLowerCase() === trimmedName.toLowerCase(),
      )
      const nextViewId = existingView?.id ?? crypto.randomUUID()
      nextSelectedViewId = nextViewId
      const nextView = {
        id: nextViewId,
        name: trimmedName,
        filters: { ...ledgerFilters },
        statisticsRange: { ...statisticsRange },
      }

      return {
        ...prev,
        [ledgerSavedViewScope]: [
          ...scopeViews.filter((view) => view.id !== nextViewId),
          nextView,
        ].sort((leftView, rightView) => leftView.name.localeCompare(rightView.name, undefined, { sensitivity: 'base' })),
      }
    })
    setSelectedSavedViewId(nextSelectedViewId)
    setGlobalError('')
    setGlobalNotice(`Saved ledger view: ${trimmedName}.`)
  }

  const handleApplySavedLedgerView = (viewId) => {
    setSelectedSavedViewId(viewId)
    const view = scopedSavedLedgerViews.find((savedView) => savedView.id === viewId)
    if (!view) {
      return
    }

    setLedgerFilters({ ...defaultLedgerFilters, ...view.filters })
    setStatisticsRange(view.statisticsRange || createTodayStatisticsRange())
    setGlobalError('')
    setGlobalNotice(`Applied saved view: ${view.name}.`)
  }

  const handleDeleteSavedLedgerView = () => {
    if (!selectedSavedViewId) {
      return
    }

    const selectedView = scopedSavedLedgerViews.find((view) => view.id === selectedSavedViewId)
    if (!selectedView) {
      return
    }

    setSavedLedgerViews((prev) => {
      const scopeViews = prev[ledgerSavedViewScope] ?? []
      const nextScopeViews = scopeViews.filter((view) => view.id !== selectedSavedViewId)
      const nextViews = { ...prev }
      if (nextScopeViews.length === 0) {
        delete nextViews[ledgerSavedViewScope]
        return nextViews
      }

      nextViews[ledgerSavedViewScope] = nextScopeViews
      return nextViews
    })
    setSelectedSavedViewId('')
    setGlobalError('')
    setGlobalNotice(`Deleted saved view: ${selectedView.name}.`)
  }

  const handleStatisticsRangeChange = (field, value) => {
    setSelectedSavedViewId('')
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

  const handleExportReport = () => {
    const guildName = selectedGuild?.name || 'Guest Ledger'
    const overallCurrentGold = getOverallCurrentGold(activeEntries)
    const exportBreakdowns = exportIncludesLedger
      ? buildLedgerExportBreakdowns({
          entries: activeEntries,
          ledgerFilters,
          selectedPeriod: exportPeriod,
          selectedRange: exportRange,
        })
      : []
    const selectedExportBreakdown = exportBreakdowns[0] ?? null

    if ((exportScope === 'member-management' || exportScope === 'full') && (!sessionUser || !selectedGuild)) {
      setGlobalError('Choose a guild before exporting members and dues reports.')
      setGlobalNotice('')
      return
    }

    exportReportBundle({
      format: exportFormat,
      reportKind: exportScope,
      guildName,
      ledgerData: {
        statisticsRows: selectedExportBreakdown?.statisticsRows ?? [],
        entries: [...(selectedExportBreakdown?.entries ?? [])].sort((leftEntry, rightEntry) =>
          rightEntry.date.localeCompare(leftEntry.date),
        ),
        period: exportPeriod,
        range: selectedExportBreakdown?.range ?? resolveStatisticsRange(exportRange),
        currentGold: overallCurrentGold,
        breakdowns: exportBreakdowns.map((breakdown) => ({
          ...breakdown,
          entries: [...breakdown.entries].sort((leftEntry, rightEntry) =>
            rightEntry.date.localeCompare(leftEntry.date),
          ),
        })),
      },
      memberManagementData: buildMemberManagementSnapshot({
        entries: activeEntries,
        trackedMembers,
        selectedGuild,
      }),
    })

    setExportDialogOpen(false)
    setGlobalError('')
    setGlobalNotice(
      `${exportScopeOptions.find((option) => option.value === exportScope)?.label || 'Report'}${exportIncludesLedger ? ` (${getLedgerExportPeriodLabel(exportPeriod)})` : ''} exported as ${exportFormat.toUpperCase()}.`,
    )
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
                <Button
                  color="inherit"
                  onClick={() => {
                    setCurrentPage('discovery')
                    setDiscoveryGuildId(null)
                  }}
                >
                  Browse Guilds
                </Button>
                <IconButton color="inherit" onClick={() => setTutorialOpen(true)} aria-label="Open tutorial">
                  <HelpOutlineIcon />
                </IconButton>
                {isMobileLayout && (
                  <IconButton
                    ref={mobileGuildMenuRef}
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
                  sx={{
                    maxWidth: { xs: '100%', sm: 280 },
                    color: '#f7edd4',
                    '& .MuiChip-label': {
                      color: '#f7edd4',
                      textShadow: '0 1px 8px rgba(0, 0, 0, 0.28)',
                    },
                  }}
                />
                <IconButton color="inherit" onClick={() => setSettingsOpen(true)} disabled={mutationPending}>
                  <SettingsIcon />
                </IconButton>
                <Button color="inherit" onClick={handleLogout} disabled={mutationPending}>
                  Log out
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ ...(currentPage === 'welcome') && { display: 'none' }, width: { xs: '100%', sm: 'auto' } }}>
                <Button
                  color="inherit"
                  onClick={() => {
                    setCurrentPage('discovery')
                    setDiscoveryGuildId(null)
                  }}
                >
                  Browse Guilds
                </Button>
                <IconButton color="inherit" onClick={() => setTutorialOpen(true)} aria-label="Open tutorial">
                  <HelpOutlineIcon />
                </IconButton>
                <Button ref={authActionRef} color="inherit" onClick={() => setAuthOpen(true)} disabled={sessionLoading}>
                  Sign up / Log in
                </Button>
              </Stack>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ display: 'flex' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
            {currentPage === 'welcome' && !sessionUser && (
              <WelcomePage
                onOpenAuth={(mode) => {
                  setAuthMode(mode)
                  setAuthOpen(true)
                }}
                onNavigate={(page) => {
                  setCurrentPage(page)
                  setDiscoveryGuildId(null)
                }}
              />
            )}

            {currentPage !== 'welcome' && (
              <>
                <Box ref={heroRef} className="eso-hero-banner">
                  <Typography variant="overline" className="eso-hero-kicker">
                    Elder Scrolls Online Guild Ledger
                  </Typography>
                  <Typography variant="h4" gutterBottom className="eso-hero-title">
                    {currentPage === 'ledger'
                      ? 'Track Guild Gold Flow'
                      : currentPage === 'dues'
                        ? 'Dues Dashboard'
                        : currentPage === 'member-management'
                          ? 'Member Management'
                          : currentPage === 'calendar'
                            ? 'Event Calendar'
                            : currentPage === 'recruitment'
                              ? 'Guild Recruitment'
                              : currentPage === 'discovery'
                                ? 'Guild Discovery'
                                : 'My Applications'}
                  </Typography>
                  <Typography variant="body1" className="eso-hero-subtitle">
                    {currentPage === 'ledger'
                      ? 'Track deposits, withdrawals, and sales tax with member-linked entries.'
                      : currentPage === 'dues'
                        ? 'Manage guild dues settings and review the current cycle.'
                        : currentPage === 'member-management'
                          ? 'Add members, update names, and keep the roster current.'
                          : currentPage === 'calendar'
                            ? 'Schedule trials, raids, and social events for your guild.'
                            : currentPage === 'recruitment'
                              ? 'Configure your public profile and manage member applications.'
                              : currentPage === 'discovery'
                                ? 'Browse recruiting guilds and find your next home in Tamriel.'
                                : 'Track the status of your sent guild applications.'}
                  </Typography>
                </Box>

                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mb: 3 }}
                >
                  {sessionUser ? (
                    <Tabs
                      ref={pageTabsRef}
                      value={['ledger', 'calendar', 'dues', 'member-management', 'recruitment', 'my-applications'].includes(currentPage) ? currentPage : false}
                      onChange={(_event, value) => {
                        setCurrentPage(value)
                        setDiscoveryGuildId(null)
                      }}
                      sx={{ minHeight: 48 }}
                    >
                      <Tab value="ledger" label="Ledger" />
                      <Tab value="calendar" label="Calendar" />
                      <Tab value="dues" label="Dues" />
                      <Tab value="member-management" label="Members" />
                      <Tab value="recruitment" label="Recruitment" />
                      <Tab value="my-applications" label="My Apps" />
                    </Tabs>
                  ) : (
                    <Box />
                  )}

                  <Button
                    variant="outlined"
                    onClick={openExportDialog}
                    disabled={mutationPending || (sessionUser && !selectedGuild)}
                    sx={{ alignSelf: { xs: 'stretch', md: 'center' } }}
                  >
                    Export Reports
                  </Button>
                </Stack>
              </>
            )}

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
                  Legacy browser data was found for this account. Import it to the server.
                </Alert>
              )}
              {legacyState && !sessionUser && !sessionLoading && (
                <Alert severity="info">
                  Legacy browser data was found. Sign in to import it to the server.
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
                  Add a verified recovery email in settings to enable password resets.
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
                  Verify {currentUser.email} to enable password recovery.
                </Alert>
              )}
              {!sessionUser && !sessionLoading && (
                <Alert severity="warning">
                  Guest mode is temporary. Create an account to save your data to the server.
                </Alert>
              )}
            </Stack>

            {currentPage === 'ledger' && (
              <>
            <Card ref={addEntryRef} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Add Entry
                </Typography>
                {sessionUser && !selectedGuild ? (
                  <Alert severity="info">Create a guild profile in the right sidebar first.</Alert>
                ) : (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    {sessionUser && selectedGuild && !selectedGuild.canEdit && (
                      <Alert severity="info" sx={{ width: '100%' }}>
                        You have viewer access to this guild. Ledger entries are view-only until the owner grants admin access.
                      </Alert>
                    )}
                    <FormControl fullWidth>
                      <InputLabel id="entry-type-label">Type</InputLabel>
                      <Select
                        labelId="entry-type-label"
                        label="Type"
                        value={entryDraft.type}
                        disabled={sessionUser && !canEditSelectedGuild}
                        onChange={(event) =>
                          setEntryDraft((prev) => ({
                            ...prev,
                            type: event.target.value,
                            isDonation: event.target.value === 'deposit' ? prev.isDonation : false,
                            isDue: event.target.value === 'deposit' ? prev.isDue : false,
                            withdrawalCategory:
                              event.target.value === 'withdrawal' ? prev.withdrawalCategory : '',
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
                      disabled={sessionUser && !canEditSelectedGuild}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, amount: event.target.value }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Date"
                      type="date"
                      value={entryDraft.date}
                      disabled={sessionUser && !canEditSelectedGuild}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, date: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                    />
                    <Autocomplete
                      freeSolo
                      fullWidth
                      options={memberSuggestions}
                      value={entryDraft.user}
                      readOnly={sessionUser && !canEditSelectedGuild}
                      onInputChange={(_event, value) =>
                        setEntryDraft((prev) => ({ ...prev, user: value }))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Member"
                        />
                      )}
                    />
                    <TextField
                      fullWidth
                      label="Optional Notes"
                      value={entryDraft.notes}
                      disabled={sessionUser && !canEditSelectedGuild}
                      onChange={(event) =>
                        setEntryDraft((prev) => ({ ...prev, notes: event.target.value }))
                      }
                    />
                    {entryDraft.type === 'deposit' && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={entryDraft.isDonation}
                              disabled={sessionUser && !canEditSelectedGuild}
                              onChange={(event) =>
                                setEntryDraft((prev) => ({
                                  ...prev,
                                  isDonation: event.target.checked,
                                  isDue: event.target.checked ? false : prev.isDue,
                                }))
                              }
                            />
                          }
                          label="Donation"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={entryDraft.isDue}
                              disabled={sessionUser && !canEditSelectedGuild}
                              onChange={(event) =>
                                setEntryDraft((prev) => ({
                                  ...prev,
                                  isDue: event.target.checked,
                                  isDonation: event.target.checked ? false : prev.isDonation,
                                }))
                              }
                            />
                          }
                          label="Dues"
                        />
                      </Stack>
                    )}
                    {entryDraft.type === 'withdrawal' && (
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          Withdrawal Purpose
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                          {withdrawalCategoryOptions.map((option) => (
                            <FormControlLabel
                              key={option.value}
                              control={
                                <Checkbox
                                  checked={entryDraft.withdrawalCategory === option.value}
                                  disabled={sessionUser && !canEditSelectedGuild}
                                  onChange={(event) =>
                                    setEntryDraft((prev) => ({
                                      ...prev,
                                      withdrawalCategory: event.target.checked ? option.value : '',
                                    }))
                                  }
                                />
                              }
                              label={option.label}
                            />
                          ))}
                        </Stack>
                      </Stack>
                    )}
                    <Button variant="contained" onClick={saveEntry} disabled={mutationPending || (sessionUser && !canEditSelectedGuild)}>
                      Save
                    </Button>
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Box>
                      <Typography variant="h6">Search, Filters, and Saved Views</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Narrow the ledger by member, amount, type, notes, and dates. Saved views keep recurring review setups one click away.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap">
                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="saved-ledger-view-label">Saved view</InputLabel>
                        <Select
                          labelId="saved-ledger-view-label"
                          label="Saved view"
                          value={selectedSavedViewId}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            if (!nextValue) {
                              setSelectedSavedViewId('')
                              return
                            }

                            handleApplySavedLedgerView(nextValue)
                          }}
                        >
                          <MenuItem value="">Custom view</MenuItem>
                          {scopedSavedLedgerViews.map((view) => (
                            <MenuItem key={view.id} value={view.id}>
                              {view.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button variant="outlined" onClick={handleSaveLedgerView}>
                        Save current view
                      </Button>
                      <Button variant="outlined" color="error" onClick={handleDeleteSavedLedgerView} disabled={!selectedSavedViewId}>
                        Delete view
                      </Button>
                      <Button variant="text" onClick={clearLedgerFilters} disabled={!hasActiveLedgerViewFilters && !selectedSavedViewId}>
                        Clear filters
                      </Button>
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
                    <TextField
                      label="Search notes, members, and types"
                      value={ledgerFilters.search}
                      onChange={(event) => handleLedgerFilterChange('search', event.target.value)}
                      sx={{ minWidth: { xs: '100%', md: 260 } }}
                    />
                    <Autocomplete
                      freeSolo
                      options={memberSuggestions}
                      value={ledgerFilters.member}
                      onInputChange={(_event, value) => handleLedgerFilterChange('member', value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Member filter" sx={{ minWidth: { xs: '100%', md: 220 } }} />
                      )}
                    />
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel id="entry-type-filter-label">Entry type</InputLabel>
                      <Select
                        labelId="entry-type-filter-label"
                        label="Entry type"
                        value={ledgerFilters.entryType}
                        onChange={(event) => handleLedgerFilterChange('entryType', event.target.value)}
                      >
                        <MenuItem value="all">All types</MenuItem>
                        {entryTypes.map((entryType) => (
                          <MenuItem key={entryType.value} value={entryType.value}>
                            {entryType.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel id="deposit-kind-filter-label">Deposit subtype</InputLabel>
                      <Select
                        labelId="deposit-kind-filter-label"
                        label="Deposit subtype"
                        value={ledgerFilters.depositKind}
                        disabled={!['all', 'deposit'].includes(ledgerFilters.entryType)}
                        onChange={(event) => handleLedgerFilterChange('depositKind', event.target.value)}
                      >
                        <MenuItem value="all">All deposits</MenuItem>
                        <MenuItem value="due">Dues only</MenuItem>
                        <MenuItem value="donation">Donations only</MenuItem>
                        <MenuItem value="standard">Standard deposits</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 190 }}>
                      <InputLabel id="withdrawal-category-filter-label">Withdrawal category</InputLabel>
                      <Select
                        labelId="withdrawal-category-filter-label"
                        label="Withdrawal category"
                        value={ledgerFilters.withdrawalCategory}
                        disabled={!['all', 'withdrawal'].includes(ledgerFilters.entryType)}
                        onChange={(event) => handleLedgerFilterChange('withdrawalCategory', event.target.value)}
                      >
                        <MenuItem value="all">All withdrawals</MenuItem>
                        {withdrawalCategoryOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Min amount"
                      type="number"
                      value={ledgerFilters.minAmount}
                      onChange={(event) => handleLedgerFilterChange('minAmount', event.target.value)}
                      sx={{ minWidth: 140 }}
                    />
                    <TextField
                      label="Max amount"
                      type="number"
                      value={ledgerFilters.maxAmount}
                      onChange={(event) => handleLedgerFilterChange('maxAmount', event.target.value)}
                      sx={{ minWidth: 140 }}
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap" alignItems={{ xs: 'stretch', md: 'center' }}>
                    <TextField
                      type="date"
                      label="Start date"
                      value={statisticsRange.startDate}
                      onChange={(event) => handleStatisticsRangeChange('startDate', event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 170 }}
                    />
                    <TextField
                      type="date"
                      label="End date"
                      value={statisticsRange.endDate}
                      onChange={(event) => handleStatisticsRangeChange('endDate', event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 170 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setSelectedSavedViewId('')
                        setStatisticsRange(createAllStatisticsRange(activeEntries))
                        setCollapsedStatisticsSections((prev) => ({ ...prev, Daily: true }))
                      }}
                    >
                      All dates
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setSelectedSavedViewId('')
                        setStatisticsRange(createTodayStatisticsRange())
                      }}
                    >
                      Today
                    </Button>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={`Showing ${filteredEntries.length} of ${activeEntries.length} entries`} color="primary" variant={hasActiveLedgerViewFilters ? 'filled' : 'outlined'} />
                    <Chip label={`Date range: ${formatDisplayDate(statisticsRange.startDate)} - ${formatDisplayDate(statisticsRange.endDate)}`} variant="outlined" />
                    {hasActiveLedgerViewFilters && <Chip label="Filtered view active" color="warning" variant="outlined" />}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card ref={statisticsRef} sx={{ mb: 3 }}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mb: 2 }}
                >
                  <Box>
                    <Typography variant="h6">Statistics</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Aggregates reflect the current filtered ledger view, so reports stay readable as the log grows.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={`Periods shown: ${statisticsRows.filter((row) => !row.isSectionHeader).length}`} variant="outlined" />
                    <Chip label={`Entries in view: ${filteredEntries.length}`} variant="outlined" />
                    <Chip label={`Top donors shown per row: ${filteredEntries.length > 0 ? 'Up to 3' : '0'}`} variant="outlined" />
                  </Stack>
                </Stack>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table stickyHeader size="small" sx={{ minWidth: 860 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Range</TableCell>
                        <TableCell align="right">Entries</TableCell>
                        <TableCell>Top Contributors</TableCell>
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
                              <TableCell colSpan={7} sx={{ fontWeight: 700, pt: 2, pb: 1, backgroundColor: 'rgba(199, 161, 93, 0.08)' }}>
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
                          <TableRow key={`${statisticsRow.section}-${statisticsRow.label}`} sx={{ '&:nth-of-type(even)': { backgroundColor: 'rgba(255, 255, 255, 0.02)' } }}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {statisticsRow.label}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{statisticsRow.entryCount ?? 0}</TableCell>
                            <TableCell>
                              {statisticsRow.topDonors?.length ? (
                                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                  {statisticsRow.topDonors.map((donor) => (
                                    <Chip
                                      key={`${statisticsRow.label}-${donor.rank}-${donor.username}`}
                                      size="small"
                                      label={`#${donor.rank} ${donor.username} • ${fmtGold(donor.amount)}`}
                                      variant="outlined"
                                    />
                                  ))}
                                </Stack>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  No donation deposits recorded
                                </Typography>
                              )}
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

            <Card ref={graphRef} sx={{ mb: 3 }}>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Statistics Graph
                    </Typography>
                    <Graph entries={filteredEntries} statisticsRange={statisticsRange} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Entry Breakdown
                    </Typography>
                    <PieBreakdownChart entries={filteredEntries} statisticsRange={statisticsRange} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card ref={logEntriesRef}>
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
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography variant="h6">Log Entries</Typography>
                      <Chip size="small" label={`${sortedEntries.length} matching`} variant="outlined" />
                    </Stack>
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
                            Member
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
                      ) : visibleEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            No entries match the current search and filter view.
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
                                {entry.type === 'deposit' && entry.isDue && (
                                  <Typography variant="caption" color="text.secondary">
                                    Dues
                                  </Typography>
                                )}
                                {entry.type === 'withdrawal' && entry.withdrawalCategory && (
                                  <Typography variant="caption" color="text.secondary">
                                    {getWithdrawalCategoryLabel(entry.withdrawalCategory)}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>{entry.user || '—'}</TableCell>
                            <TableCell align="right">{fmtGold(entry.amount)}</TableCell>
                            <TableCell>{entry.notes || '—'}</TableCell>
                            <TableCell align="right">
                              <IconButton onClick={() => setEditingEntry({ ...entry })} disabled={sessionUser && !canEditSelectedGuild}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => deleteEntry(entry.id)} disabled={mutationPending || (sessionUser && !canEditSelectedGuild)}>
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
              </>
            )}

            {currentPage === 'dues' && sessionUser && (
              <DuesDashboardPage
                selectedGuild={selectedGuild}
                entries={activeEntries}
                trackedMembers={trackedMembers}
                overviewRef={duesOverviewRef}
                historyRef={duesHistoryRef}
                mutationPending={mutationPending}
                canEdit={canEditSelectedGuild}
                onUpdateGuildDuesSettings={handleUpdateGuildDueSettings}
                onUpdateTrackedMember={handleUpdateTrackedMember}
                fmtGold={fmtGold}
              />
            )}

            {currentPage === 'calendar' && sessionUser && selectedGuild && (
              <CalendarPage
                selectedGuild={selectedGuild}
                trackedMembers={trackedMembers}
                canEdit={canManageEventsSelectedGuild}
              />
            )}

            {currentPage === 'recruitment' && sessionUser && selectedGuild && (
              <Box>
                <Tabs
                  value={recruitmentTab}
                  onChange={(_e, v) => setRecruitmentTab(v)}
                  sx={{ mb: 3 }}
                >
                  <Tab value="settings" label="Profile & Settings" />
                  <Tab value="applications" label="Applications" />
                  <Tab value="webhooks" label="Webhooks" />
                </Tabs>
                {recruitmentTab === 'settings' ? (
                  <RecruitmentSettings guildId={selectedGuild.id} canEdit={canEditSelectedGuild} />
                ) : recruitmentTab === 'applications' ? (
                  <OfficerApplications
                    guildId={selectedGuild.id}
                    canEdit={canEditSelectedGuild}
                    onApplicationReviewed={(user) => setServerUser(user)}
                  />
                ) : (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Discord Webhooks</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Configure real-time notifications for guild activity.
                      </Typography>

                      <Stack spacing={3}>
                        {canEditSelectedGuild && (
                          <Box component="form" onSubmit={(e) => {
                            e.preventDefault()
                            const fd = new FormData(e.target)
                            handleCreateWebhook({
                              url: fd.get('url'),
                              channelName: fd.get('channelName'),
                              eventTypes: ['audit_log', 'application_submitted', 'application_approved', 'event_created', 'daily_summary']
                            })
                            e.target.reset()
                          }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                              <TextField name="channelName" label="Channel Name (e.g. #alerts)" required size="small" />
                              <TextField name="url" label="Webhook URL" required fullWidth size="small" />
                              <Button type="submit" variant="contained" disabled={mutationPending}>Add Webhook</Button>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              New webhooks subscribe to all event types by default.
                            </Typography>
                          </Box>
                        )}

                        <Divider />

                        {webhooksLoading ? <Typography>Loading webhooks...</Typography> : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Channel</TableCell>
                                <TableCell>URL</TableCell>
                                <TableCell>Events</TableCell>
                                <TableCell align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {webhooks.length === 0 ? (
                                <TableRow><TableCell colSpan={4} align="center">No webhooks configured.</TableCell></TableRow>
                              ) : webhooks.map(w => (
                                <TableRow key={w.id}>
                                  <TableCell>{w.channel_name}</TableCell>
                                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {w.url}
                                  </TableCell>
                                  <TableCell>
                                    {w.eventTypes.length} types
                                  </TableCell>
                                  <TableCell align="right">
                                    <IconButton size="small" color="error" onClick={() => handleDeleteWebhook(w.id)} disabled={mutationPending || !canEditSelectedGuild}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}

            {currentPage === 'discovery' && (
              discoveryGuildId ? (
                <PublicGuildProfile
                  guildId={discoveryGuildId}
                  onBack={() => setDiscoveryGuildId(null)}
                  currentUser={currentUser}
                />
              ) : (
                <GuildDiscoveryPage onSelectGuild={(id) => setDiscoveryGuildId(id)} />
              )
            )}

            {currentPage === 'my-applications' && sessionUser && (
              <MyApplications />
            )}

            {currentPage === 'member-management' && sessionUser && (
              <MemberManagementPage
                selectedGuild={selectedGuild}
                trackedMembers={trackedMembers}
                ranks={selectedGuild?.ranks || []}
                controlsRef={memberManagementControlsRef}
                tableRef={memberManagementRosterRef}
                mutationPending={mutationPending}
                canEdit={canEditSelectedGuild}
                onCreateTrackedMember={handleCreateTrackedMember}
                onUpdateTrackedMember={handleUpdateTrackedMember}
                onDeleteTrackedMember={handleDeleteTrackedMember}
                onOpenRankManagement={() => setRankManagementOpen(true)}
                onOpenCharacterManagement={(member) => {
                  setSelectedMemberForCharacters(member)
                  setCharacterManagementOpen(true)
                }}
                fmtGold={fmtGold}
              />
            )}
          </Box>

          {sessionUser && (
            <GuildProfilesDrawer
              currentUser={currentUser}
              drawerContentRef={guildDrawerRef}
              guildDrawerWidth={guildDrawerWidth}
              newGuildName={newGuildName}
              setNewGuildName={setNewGuildName}
              settingsInviteError={settingsInviteError}
              settingsInviteCode={settingsInviteCode}
              setSettingsInviteCode={setSettingsInviteCode}
              handleCreateGuild={handleCreateGuild}
              handleRedeemInviteCode={handleRedeemInviteCode}
              mutationPending={mutationPending}
              handleOpenAuditLog={handleOpenAuditLog}
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
        handleUpdateGuildMemberRole={handleUpdateGuildMemberRole}
        handleRemoveGuildMember={handleRemoveGuildMember}
      />

      <AuditLogDialog
        open={auditLogOpen}
        onClose={handleCloseAuditLog}
        guildName={auditLogGuild?.name ?? ''}
        auditLogs={auditLogs}
        auditLogLoading={auditLogLoading}
        auditLogError={auditLogError}
      />

      <RankManagementDialog
        open={rankManagementOpen}
        onClose={() => setRankManagementOpen(false)}
        ranks={selectedGuild?.ranks || []}
        onCreateRank={async (draft) => {
          if (!selectedGuild) return false
          setMutationPending(true)
          try {
            const response = await createGuildRank(selectedGuild.id, draft)
            persistAuthenticatedUser(response.user, "Rank created.")
            return true
          } catch (error) { handleApiError(error); return false }
          finally { setMutationPending(false) }
        }}
        onUpdateRank={async (rankId, draft) => {
          if (!selectedGuild) return false
          setMutationPending(true)
          try {
            const response = await updateGuildRank(selectedGuild.id, rankId, draft)
            persistAuthenticatedUser(response.user, "Rank updated.")
            return true
          } catch (error) { handleApiError(error); return false }
          finally { setMutationPending(false) }
        }}
        onDeleteRank={async (rankId) => {
          if (!selectedGuild) return false
          if (!window.confirm("Delete this rank? Members with this rank will be set to None.")) return
          setMutationPending(true)
          try {
            const response = await deleteGuildRank(selectedGuild.id, rankId)
            persistAuthenticatedUser(response.user, "Rank deleted.")
          } catch (error) { handleApiError(error) }
          finally { setMutationPending(false) }
        }}
        mutationPending={mutationPending}
      />

      <CharacterManagementDialog
        open={characterManagementOpen}
        onClose={() => {
          setCharacterManagementOpen(false)
          setSelectedMemberForCharacters(null)
        }}
        member={selectedMemberForCharacters}
        onCreateCharacter={async (memberId, draft) => {
          if (!selectedGuild) return false
          setMutationPending(true)
          try {
            const response = await createCharacter(selectedGuild.id, memberId, draft)
            persistAuthenticatedUser(response.user, "Character added.")
            return true
          } catch (error) { handleApiError(error); return false }
          finally { setMutationPending(false) }
        }}
        onUpdateCharacter={async (memberId, characterId, draft) => {
          if (!selectedGuild) return false
          setMutationPending(true)
          try {
            const response = await updateCharacter(selectedGuild.id, memberId, characterId, draft)
            persistAuthenticatedUser(response.user, "Character updated.")
            return true
          } catch (error) { handleApiError(error); return false }
          finally { setMutationPending(false) }
        }}
        onDeleteCharacter={async (memberId, characterId) => {
          if (!selectedGuild) return
          if (!window.confirm("Delete this character?")) return
          setMutationPending(true)
          try {
            const response = await deleteCharacter(selectedGuild.id, memberId, characterId)
            persistAuthenticatedUser(response.user, "Character deleted.")
          } catch (error) { handleApiError(error) }
          finally { setMutationPending(false) }
        }}
        mutationPending={mutationPending}
      />

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Reports</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Choose whether to export ledger activity, the combined members and dues report, or a full report, then pick CSV or PDF.
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="export-scope-label">Report selection</InputLabel>
              <Select
                labelId="export-scope-label"
                label="Report selection"
                value={exportScope}
                onChange={(event) => setExportScope(event.target.value)}
              >
                {exportScopeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {exportIncludesLedger && (
              <>
                <FormControl fullWidth>
                  <InputLabel id="export-period-label">Ledger period</InputLabel>
                  <Select
                    labelId="export-period-label"
                    label="Ledger period"
                    value={exportPeriod}
                    onChange={(event) => {
                      const nextPeriod = event.target.value
                      setExportPeriod(nextPeriod)
                      setExportRange(createLedgerExportRange(nextPeriod, activeEntries))
                    }}
                  >
                    {ledgerExportPeriodOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Start date"
                    type="date"
                    value={exportRange.startDate}
                    onChange={(event) =>
                      setExportRange((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="End date"
                    type="date"
                    value={exportRange.endDate}
                    onChange={(event) =>
                      setExportRange((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Stack>
              </>
            )}
            <FormControl fullWidth>
              <InputLabel id="export-format-label">File format</InputLabel>
              <Select
                labelId="export-format-label"
                label="File format"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
              >
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="pdf">PDF</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" variant="outlined">
              {exportIncludesLedger
                ? `Ledger exports use the ${getLedgerExportPeriodLabel(exportPeriod).toLowerCase()} view for ${formatDisplayDateRange(resolveStatisticsRange(exportRange).startDate, resolveStatisticsRange(exportRange).endDate)} and respect your current ledger filters.`
                : exportScope === 'member-management'
                  ? 'Members and dues exports include shared dues settings, roster status, and recent dues and donation history.'
                  : 'Full combined exports bundle both the ledger report and the members and dues report into one file.'}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleExportReport}>
            Export {exportFormat.toUpperCase()}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(pendingDueSchemeChange)}
        onClose={() => setPendingDueSchemeChange(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          Confirm Dues Scheme Change
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body1">
              Switch <strong>{pendingDueSchemeChange?.guildName || 'this guild'}</strong> from{' '}
              {pendingDueSchemeChange?.currentDueScheme || 'monthly'} to{' '}
              {pendingDueSchemeChange?.nextDueScheme || 'weekly'} dues?
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                label={`Current: ${pendingDueSchemeChange?.currentDueScheme || 'monthly'}`}
                variant="outlined"
              />
              <Chip
                label={`New: ${pendingDueSchemeChange?.nextDueScheme || 'weekly'}`}
                color="warning"
              />
            </Stack>
            <Alert severity="warning" variant="outlined">
              Current dues recorded for this{' '}
              {pendingDueSchemeChange?.currentDueScheme === 'weekly' ? 'week' : 'month'} may be overridden when the scheme changes.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Use this when you are ready to reset the guild onto one shared cadence.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingDueSchemeChange(null)}>Keep Current Scheme</Button>
          <Button variant="contained" color="warning" disabled={mutationPending} onClick={handleConfirmDueSchemeChange}>
            Switch Scheme
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
                  disabled={sessionUser && !canEditSelectedGuild}
                  onChange={(event) =>
                    setEditingEntry((prev) => ({
                      ...prev,
                      type: event.target.value,
                      isDonation: event.target.value === 'deposit' ? prev.isDonation : false,
                      isDue: event.target.value === 'deposit' ? prev.isDue : false,
                      withdrawalCategory:
                        event.target.value === 'withdrawal' ? prev.withdrawalCategory : '',
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
                disabled={sessionUser && !canEditSelectedGuild}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, amount: Number(event.target.value) }))
                }
              />
              <TextField
                label="Date"
                type="date"
                value={editingEntry.date}
                disabled={sessionUser && !canEditSelectedGuild}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, date: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
              <Autocomplete
                freeSolo
                options={memberSuggestions}
                value={editingEntry.user || ''}
                readOnly={sessionUser && !canEditSelectedGuild}
                onInputChange={(_event, value) =>
                  setEditingEntry((prev) => ({ ...prev, user: value }))
                }
                renderInput={(params) => <TextField {...params} label="Member" />}
              />
              <TextField
                label="Notes"
                value={editingEntry.notes}
                disabled={sessionUser && !canEditSelectedGuild}
                onChange={(event) =>
                  setEditingEntry((prev) => ({ ...prev, notes: event.target.value }))
                }
                multiline
                minRows={2}
              />
              {editingEntry.type === 'deposit' && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(editingEntry.isDonation)}
                        disabled={sessionUser && !canEditSelectedGuild}
                        onChange={(event) =>
                          setEditingEntry((prev) => ({
                            ...prev,
                            isDonation: event.target.checked,
                            isDue: event.target.checked ? false : prev.isDue,
                          }))
                        }
                      />
                    }
                    label="Donation"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(editingEntry.isDue)}
                        disabled={sessionUser && !canEditSelectedGuild}
                        onChange={(event) =>
                          setEditingEntry((prev) => ({
                            ...prev,
                            isDue: event.target.checked,
                            isDonation: event.target.checked ? false : prev.isDonation,
                          }))
                        }
                      />
                    }
                    label="Dues"
                  />
                </Stack>
              )}
              {editingEntry.type === 'withdrawal' && (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Withdrawal Purpose
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                    {withdrawalCategoryOptions.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        control={
                          <Checkbox
                            checked={editingEntry.withdrawalCategory === option.value}
                            disabled={sessionUser && !canEditSelectedGuild}
                            onChange={(event) =>
                              setEditingEntry((prev) => ({
                                ...prev,
                                withdrawalCategory: event.target.checked ? option.value : '',
                              }))
                            }
                          />
                        }
                        label={option.label}
                      />
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingEntry(null)}>Cancel</Button>
          <Button
            disabled={sessionUser && !canEditSelectedGuild}
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
            disabled={mutationPending || (sessionUser && !canEditSelectedGuild)}
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

      <TutorialOverlay open={tutorialOpen} steps={tutorialSteps} onFinish={handleFinishTutorial} />
    </ThemeProvider>
  )
}

export default App
