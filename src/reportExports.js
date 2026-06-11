import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDisplayDate, formatDisplayDateTime } from './utils/dateFormatting'

const slugify = (value) =>
  String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report'

const formatTimestamp = (date = new Date()) => formatDisplayDateTime(date)
const formatDisplayDateRange = (startDate, endDate) =>
  startDate === endDate
    ? formatDisplayDate(startDate)
    : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`

const toGold = (value) => Math.round(Number(value) || 0)
const fmtGold = (value) => `${toGold(value).toLocaleString()}g`

const getLedgerPeriodLabel = (period) => {
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

export const summarizeLedgerEntries = (entries) => {
  const summary = entries.reduce(
    (totals, entry) => {
      const amount = toGold(entry.amount)

      totals.entryCount += 1

      if (entry.type === 'deposit') {
        totals.deposits += amount

        if (entry.isDonation) {
          totals.donations += amount
        }

        if (entry.isDue) {
          totals.dues += amount
        }
      }

      if (entry.type === 'salesTax') {
        totals.salesTax += amount
      }

      if (entry.type === 'withdrawal') {
        totals.withdrawals += amount
      }

      return totals
    },
    {
      deposits: 0,
      donations: 0,
      dues: 0,
      salesTax: 0,
      withdrawals: 0,
      entryCount: 0,
    },
  )

  return {
    ...summary,
    grossIncome: summary.deposits + summary.salesTax,
    netTotal: summary.deposits + summary.salesTax - summary.withdrawals,
  }
}

export const getOverallCurrentGold = (entries) => summarizeLedgerEntries(entries).netTotal

export const getTopDonorRows = (entries, limit = 5) => {
  const donorTotals = entries.reduce((totals, entry) => {
    if (entry.type !== 'deposit' || !entry.isDonation) {
      return totals
    }

    const username = entry.user?.trim() || 'Unknown user'
    totals.set(username, (totals.get(username) || 0) + toGold(entry.amount))
    return totals
  }, new Map())

  return [...donorTotals.entries()]
    .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
    .slice(0, limit)
    .map(([username, amount], index) => ({
      rank: index + 1,
      username,
      amount,
    }))
}

export const buildLedgerBreakdownSections = (title, breakdowns) =>
  breakdowns.map((breakdown) => {
    const flattenedStatisticsRows = breakdown.statisticsRows
      .filter((row) => !row.isSectionHeader)
      .map((row) => {
        const grandTotal = toGold(row.totals.deposit) + toGold(row.totals.salesTax) - toGold(row.totals.withdrawal)
        const topContributors = row.topDonors?.length
          ? row.topDonors.map((donor) => `#${donor.rank} ${donor.username} (${fmtGold(donor.amount)})`).join(' | ')
          : ''

        return [
          row.label,
          row.entryCount,
          toGold(row.totals.deposit),
          toGold(row.totals.withdrawal),
          toGold(row.totals.salesTax),
          grandTotal,
          topContributors,
        ]
      })

    return {
      title: `${title} ${breakdown.title}`,
      headers: ['Range', 'Entries', 'Deposits', 'Withdrawals', 'Sales Tax', 'Net Total', 'Top Contributors'],
      rows: flattenedStatisticsRows,
    }
  })

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

const buildLedgerSections = ({ title, guildName, generatedAt, statisticsRows, entries, period, range, currentGold }) => {
  const summary = summarizeLedgerEntries(entries)
  const topDonors = getTopDonorRows(entries)
  const breakdowns = [
    {
      title: `${getLedgerPeriodLabel(period)} breakdown`,
      period,
      range,
      statisticsRows,
    },
  ]
  const breakdownSections = buildLedgerBreakdownSections(title, breakdowns)

  return [
    {
      title: `${title} Metadata`,
      headers: ['Field', 'Value'],
      rows: [
        ['Guild', guildName],
        ['Generated', generatedAt],
        ['Overall current gold', fmtGold(currentGold)],
        ['Ledger period', getLedgerPeriodLabel(period)],
        ['Selected range', formatDisplayDateRange(range.startDate, range.endDate)],
        ['Entry count', entries.length],
      ],
    },
    {
      title: `${title} Summary`,
      headers: ['Metric', 'Value'],
      rows: [
        ['Overall current gold', fmtGold(currentGold)],
        ['Gross income', fmtGold(summary.grossIncome)],
        ['Net total', fmtGold(summary.netTotal)],
        ['Deposits', fmtGold(summary.deposits)],
        ['Withdrawals', fmtGold(summary.withdrawals)],
        ['Sales tax', fmtGold(summary.salesTax)],
        ['Donations', fmtGold(summary.donations)],
        ['Dues', fmtGold(summary.dues)],
      ],
    },
    {
      title: `${title} Top Donors`,
      headers: ['Rank', 'Member', 'Donation Total'],
      rows: topDonors.length
        ? topDonors.map((donor) => [donor.rank, donor.username, fmtGold(donor.amount)])
        : [['-', 'No donations in selected range', '-']],
    },
    ...breakdownSections,
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

const buildMemberManagementSections = ({ title, guildName, generatedAt, snapshot, currentGold }) => [
  {
    title: `${title} Metadata`,
    headers: ['Field', 'Value'],
    rows: [
      ['Guild', guildName],
      ['Generated', generatedAt],
      ['Overall current gold', fmtGold(currentGold)],
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

const ensurePageSpace = (doc, cursorY, neededHeight = 20) => {
  const pageHeight = doc.internal.pageSize.getHeight()

  if (cursorY + neededHeight <= pageHeight - 14) {
    return cursorY
  }

  doc.addPage()
  return 18
}

const renderPdfTable = (doc, cursorY, section) => {
  const nextCursorY = ensurePageSpace(doc, cursorY, 16)

  doc.setFontSize(12)
  doc.setTextColor(31, 41, 55)
  doc.text(section.title, 14, nextCursorY)

  autoTable(doc, {
    startY: nextCursorY + 4,
    head: section.headers?.length ? [section.headers] : undefined,
    body: section.rows.length ? section.rows : [['No data available']],
    styles: {
      fontSize: 8,
      cellPadding: 2.25,
      textColor: [31, 41, 55],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252],
      fontStyle: 'bold',
    },
    bodyStyles: {
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  })

  return (doc.lastAutoTable?.finalY || nextCursorY) + 9
}

const renderPdfHeader = (doc, reportTitle, metadataLines) => {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(17, 24, 39)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setTextColor(248, 250, 252)
  doc.setFontSize(18)
  doc.text(reportTitle, 14, 12)
  doc.setFontSize(8.5)

  metadataLines.forEach((line, index) => {
    doc.text(line, 14, 18 + index * 4)
  })

  return 34
}

const renderPdfSections = (doc, reportTitle, sections, metadataLines) => {
  let cursorY = renderPdfHeader(doc, reportTitle, metadataLines)

  for (const section of sections) {
    cursorY = renderPdfTable(doc, cursorY, section)
  }
}

const addPdfFooters = (doc) => {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
  }
}

const createFileName = (guildName, reportKind, extension, ledgerPeriod) =>
  `${slugify(guildName)}-${slugify(reportKind)}${ledgerPeriod ? `-${slugify(ledgerPeriod)}` : ''}-${new Date().toISOString().slice(0, 10)}.${extension}`

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
      period: ledgerData.period,
      range: ledgerData.range,
      currentGold: ledgerData.currentGold,
    }))

    if (ledgerData.breakdowns?.length > 1) {
      sections.splice(
        3,
        1,
        ...buildLedgerBreakdownSections(
          reportKind === 'full' ? 'Ledger Report' : 'Ledger Report',
          ledgerData.breakdowns,
        ),
      )
    }
  }

  if (reportKind === 'member-management' || reportKind === 'full') {
    sections.push(...buildMemberManagementSections({
      title: reportKind === 'full' ? 'Member Management Report' : 'Member Management Report',
      guildName: normalizedGuildName,
      generatedAt,
      snapshot: memberManagementData,
      currentGold: ledgerData?.currentGold ?? 0,
    }))
  }

  if (format === 'csv') {
    downloadCsv(
      createCsvContent(sections),
      createFileName(normalizedGuildName, reportKind, 'csv', reportKind === 'member-management' ? '' : ledgerData?.period),
    )
    return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  renderPdfSections(
    doc,
    reportKind === 'full' ? `${normalizedGuildName} Full Report` : `${normalizedGuildName} ${reportKind === 'ledger' ? 'Ledger Report' : 'Member Management Report'}`,
    sections,
    [
      `Guild: ${normalizedGuildName}    Generated: ${generatedAt}`,
      reportKind === 'member-management' || !ledgerData?.range
        ? 'Report scope: Members and dues'
        : `Ledger period: ${getLedgerPeriodLabel(ledgerData.period)}    Range: ${formatDisplayDateRange(ledgerData.range.startDate, ledgerData.range.endDate)}`,
    ],
  )
  addPdfFooters(doc)
  doc.save(createFileName(normalizedGuildName, reportKind, 'pdf', reportKind === 'member-management' ? '' : ledgerData?.period))
}