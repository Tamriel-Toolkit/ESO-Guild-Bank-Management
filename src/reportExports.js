import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const EST_TIME_ZONE = 'America/New_York'
const EST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: EST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const slugify = (value) =>
  String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report'

const formatDisplayDate = (isoDate) => {
  if (!isoDate) {
    return ''
  }

  const [year, month, day] = String(isoDate).split('-')
  if (!year || !month || !day) {
    return String(isoDate)
  }

  return `${month}/${day}/${year}`
}

const formatTimestamp = (date = new Date()) =>
  date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const toGold = (value) => Math.round(Number(value) || 0)
const fmtGold = (value) => `${toGold(value).toLocaleString()}g`

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

const getEntryTypeLabel = (entry) => {
  if (entry.type === 'deposit' && entry.isDonation) {
    return 'Deposit - Donation'
  }
  if (entry.type === 'deposit' && entry.isDue) {
    return 'Deposit - Dues'
  }
  if (entry.type === 'salesTax') {
    return 'Sales Tax'
  }
  if (entry.type === 'withdrawal' && entry.withdrawalCategory) {
    return `Withdrawal - ${entry.withdrawalCategory}`
  }

  return entry.type
}

const createCsvContent = (sections) => {
  const lines = []

  for (const section of sections) {
    lines.push(section.title)

    if (section.headers?.length) {
      lines.push(section.headers.map((value) => escapeCsvCell(value)).join(','))
    }

    for (const row of section.rows) {
      lines.push(row.map((value) => escapeCsvCell(value)).join(','))
    }

    lines.push('')
  }

  return lines.join('\r\n')
}

const escapeCsvCell = (value) => {
  const normalizedValue = value === null || typeof value === 'undefined' ? '' : String(value)
  if (!/[",\r\n]/.test(normalizedValue)) {
    return normalizedValue
  }

  return `"${normalizedValue.replace(/"/g, '""')}"`
}

const downloadBlob = (blob, fileName) => {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

const downloadCsv = (content, fileName) => {
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName)
}

const buildLedgerSections = ({ title, guildName, generatedAt, statisticsRows, entries }) => {
  const flattenedStatisticsRows = statisticsRows.map((row) => {
    if (row.isSectionHeader) {
      return [row.section, '', '', '', '', '', '']
    }

    const grandTotal = toGold(row.totals.deposit) + toGold(row.totals.salesTax) - toGold(row.totals.withdrawal)
    const topContributors = row.topDonors?.length
      ? row.topDonors.map((donor) => `#${donor.rank} ${donor.username} (${fmtGold(donor.amount)})`).join(' | ')
      : ''

    return [
      row.section,
      row.label,
      toGold(row.totals.deposit),
      toGold(row.totals.withdrawal),
      toGold(row.totals.salesTax),
      grandTotal,
      topContributors,
    ]
  })

  return [
    {
      title: `${title} Metadata`,
      headers: ['Field', 'Value'],
      rows: [
        ['Guild', guildName],
        ['Generated', generatedAt],
        ['Entry count', entries.length],
      ],
    },
    {
      title: `${title} Statistics`,
      headers: ['Section', 'Range', 'Deposits', 'Withdrawals', 'Sales Tax', 'Grand Total', 'Top Contributors'],
      rows: flattenedStatisticsRows,
    },
    {
      title: `${title} Entries`,
      headers: ['Date', 'Type', 'Member', 'Amount', 'Notes'],
      rows: entries.map((entry) => [
        formatDisplayDate(entry.date),
        getEntryTypeLabel(entry),
        entry.user || '',
        toGold(entry.amount),
        entry.notes || '',
      ]),
    },
  ]
}

export const buildMemberManagementSnapshot = ({ entries, trackedMembers, selectedGuild }) => {
  const duesScheme = selectedGuild?.dueScheme === 'weekly' ? 'weekly' : 'monthly'
  const defaultDuesAmount = Number(selectedGuild?.defaultDuesAmount) || 0
  const currentCycle = getCycleForScheme(duesScheme)
  const dueEntries = entries.filter((entry) => entry.type === 'deposit' && entry.isDue)
  const donationEntries = entries.filter((entry) => entry.type === 'deposit' && entry.isDonation)

  const lifetimeContributionTotals = new Map()
  for (const entry of entries) {
    if (entry.type !== 'deposit') {
      continue
    }

    const key = toMemberKey(entry.user)
    const previous = lifetimeContributionTotals.get(key) || {
      dues: 0,
      donations: 0,
      deposits: 0,
      lastPaymentDate: '',
    }
    lifetimeContributionTotals.set(key, {
      dues: previous.dues + (entry.isDue ? toGold(entry.amount) : 0),
      donations: previous.donations + (entry.isDonation ? toGold(entry.amount) : 0),
      deposits: previous.deposits + toGold(entry.amount),
      lastPaymentDate: previous.lastPaymentDate > entry.date ? previous.lastPaymentDate : entry.date,
    })
  }

  const members = trackedMembers.map((member) => {
    const cyclePaid = dueEntries.reduce((total, entry) => {
      if (entry.date < currentCycle.startDate || entry.date > currentCycle.endDate) {
        return total
      }

      return toMemberKey(entry.user) === toMemberKey(member.name) ? total + toGold(entry.amount) : total
    }, 0)
    const effectiveDuesAmount = member.useDefaultDues ? defaultDuesAmount : toGold(member.duesAmount)
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
  })

  const summary = {
    expected: members.reduce(
      (total, member) => total + (member.isActive && !member.duesExempt ? member.totalExpected : 0),
      0,
    ),
    collected: members.reduce((total, member) => total + member.cyclePaid, 0),
    paidCount: members.filter((member) => member.status === 'Paid').length,
    partialCount: members.filter((member) => member.status === 'Partial').length,
    dueCount: members.filter((member) => member.status === 'Due').length,
    excludedCount: members.filter((member) => member.status === 'Excluded').length,
  }

  return {
    duesScheme,
    defaultDuesAmount,
    currentCycle,
    members,
    summary,
    dueHistory: [...dueEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8),
    donationHistory: [...donationEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8),
  }
}

const buildMemberManagementSections = ({ title, guildName, generatedAt, snapshot }) => [
  {
    title: `${title} Metadata`,
    headers: ['Field', 'Value'],
    rows: [
      ['Guild', guildName],
      ['Generated', generatedAt],
      ['Dues scheme', snapshot.duesScheme],
      ['Current cycle', snapshot.currentCycle.label],
      ['Default dues amount', toGold(snapshot.defaultDuesAmount)],
    ],
  },
  {
    title: `${title} Summary`,
    headers: ['Expected', 'Collected', 'Outstanding', 'Paid', 'Partial', 'Due', 'Excluded'],
    rows: [[
      toGold(snapshot.summary.expected),
      toGold(snapshot.summary.collected),
      Math.max(toGold(snapshot.summary.expected) - toGold(snapshot.summary.collected), 0),
      snapshot.summary.paidCount,
      snapshot.summary.partialCount,
      snapshot.summary.dueCount,
      snapshot.summary.excludedCount,
    ]],
  },
  {
    title: `${title} Roster`,
    headers: ['Member', 'Status', 'Effective Dues', 'Uses Default', 'Excluded', 'Active', 'Paid This Cycle', 'Outstanding', 'Lifetime Dues', 'Lifetime Donations', 'Last Payment'],
    rows: snapshot.members.map((member) => [
      member.name,
      member.status,
      toGold(member.effectiveDuesAmount),
      member.useDefaultDues ? 'Yes' : 'No',
      member.duesExempt ? 'Yes' : 'No',
      member.isActive ? 'Yes' : 'No',
      toGold(member.cyclePaid),
      toGold(member.outstanding),
      toGold(member.contribution.dues),
      toGold(member.contribution.donations),
      formatDisplayDate(member.contribution.lastPaymentDate),
    ]),
  },
  {
    title: `${title} Recent Dues History`,
    headers: ['Date', 'Member', 'Amount', 'Notes'],
    rows: snapshot.dueHistory.map((entry) => [
      formatDisplayDate(entry.date),
      entry.user || 'Unassigned member',
      toGold(entry.amount),
      entry.notes || '',
    ]),
  },
  {
    title: `${title} Recent Donation History`,
    headers: ['Date', 'Member', 'Amount', 'Notes'],
    rows: snapshot.donationHistory.map((entry) => [
      formatDisplayDate(entry.date),
      entry.user || 'Unassigned member',
      toGold(entry.amount),
      entry.notes || '',
    ]),
  },
]

const renderPdfSections = (doc, reportTitle, sections) => {
  let cursorY = 18

  doc.setFontSize(18)
  doc.text(reportTitle, 14, cursorY)
  cursorY += 10

  for (const section of sections) {
    doc.setFontSize(12)
    doc.text(section.title, 14, cursorY)
    cursorY += 4

    autoTable(doc, {
      startY: cursorY,
      head: section.headers?.length ? [section.headers] : undefined,
      body: section.rows.length ? section.rows : [['No data available']],
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [34, 46, 60],
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: 14, right: 14 },
    })

    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 10
  }
}

const createFileName = (guildName, reportKind, extension) =>
  `${slugify(guildName)}-${slugify(reportKind)}-${new Date().toISOString().slice(0, 10)}.${extension}`

export const exportReportBundle = ({
  format,
  reportKind,
  guildName,
  ledgerData,
  memberManagementData,
}) => {
  const generatedAt = formatTimestamp()
  const normalizedGuildName = guildName || 'Guild Report'

  const sections = []
  if (reportKind === 'ledger' || reportKind === 'full') {
    sections.push(...buildLedgerSections({
      title: reportKind === 'full' ? 'Ledger Report' : 'Ledger Report',
      guildName: normalizedGuildName,
      generatedAt,
      statisticsRows: ledgerData.statisticsRows,
      entries: ledgerData.entries,
    }))
  }

  if (reportKind === 'member-management' || reportKind === 'full') {
    sections.push(...buildMemberManagementSections({
      title: reportKind === 'full' ? 'Member Management Report' : 'Member Management Report',
      guildName: normalizedGuildName,
      generatedAt,
      snapshot: memberManagementData,
    }))
  }

  if (format === 'csv') {
    downloadCsv(createCsvContent(sections), createFileName(normalizedGuildName, reportKind, 'csv'))
    return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  renderPdfSections(
    doc,
    reportKind === 'full' ? `${normalizedGuildName} Full Report` : `${normalizedGuildName} ${reportKind === 'ledger' ? 'Ledger Report' : 'Member Management Report'}`,
    sections,
  )
  doc.save(createFileName(normalizedGuildName, reportKind, 'pdf'))
}