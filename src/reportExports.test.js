import { describe, expect, it } from 'vitest'
import { buildLedgerBreakdownSections, getOverallCurrentGold, getTopDonorRows, summarizeLedgerEntries } from './reportExports'

describe('reportExports helpers', () => {
  it('summarizes ledger totals for the selected export range', () => {
    const summary = summarizeLedgerEntries([
      { type: 'deposit', amount: 1000, isDonation: false, isDue: false },
      { type: 'deposit', amount: 250, isDonation: true, isDue: false },
      { type: 'deposit', amount: 400, isDonation: false, isDue: true },
      { type: 'salesTax', amount: 300 },
      { type: 'withdrawal', amount: 500 },
    ])

    expect(summary).toEqual({
      deposits: 1650,
      donations: 250,
      dues: 400,
      salesTax: 300,
      withdrawals: 500,
      entryCount: 5,
      grossIncome: 1950,
      netTotal: 1450,
    })
  })

  it('ranks top donors from donation deposits only', () => {
    const rows = getTopDonorRows([
      { type: 'deposit', amount: 300, isDonation: true, user: 'Aela' },
      { type: 'deposit', amount: 250, isDonation: true, user: 'Brina' },
      { type: 'deposit', amount: 200, isDonation: true, user: 'Aela' },
      { type: 'deposit', amount: 500, isDonation: false, user: 'DuesOnly' },
      { type: 'withdrawal', amount: 1000, isDonation: true, user: 'Ignored' },
    ])

    expect(rows).toEqual([
      { rank: 1, username: 'Aela', amount: 500 },
      { rank: 2, username: 'Brina', amount: 250 },
    ])
  })

  it('computes overall current gold from the full ledger regardless of export range', () => {
    expect(
      getOverallCurrentGold([
        { type: 'deposit', amount: 1200 },
        { type: 'salesTax', amount: 300 },
        { type: 'withdrawal', amount: 450 },
      ]),
    ).toBe(1050)
  })

  it('creates appended breakdown sections for smaller current periods', () => {
    const sections = buildLedgerBreakdownSections('Ledger Report', [
      {
        title: 'Overall breakdown',
        statisticsRows: [
          {
            label: 'Jan 1 - Jun 11',
            entryCount: 10,
            totals: { deposit: 2000, withdrawal: 500, salesTax: 250 },
            topDonors: [{ rank: 1, username: 'Aela', amount: 300 }],
          },
        ],
      },
      {
        title: 'Current weekly snapshot',
        statisticsRows: [
          {
            label: 'Jun 7 - Jun 13',
            entryCount: 2,
            totals: { deposit: 300, withdrawal: 50, salesTax: 25 },
            topDonors: [],
          },
        ],
      },
      {
        title: 'Current daily snapshot',
        statisticsRows: [],
      },
    ])

    expect(sections.map((section) => section.title)).toEqual([
      'Ledger Report Overall breakdown',
      'Ledger Report Current weekly snapshot',
      'Ledger Report Current daily snapshot',
    ])
    expect(sections[0].rows[0]).toEqual(['Jan 1 - Jun 11', 10, 2000, 500, 250, 1750, '#1 Aela (300g)'])
    expect(sections[2].rows).toEqual([])
  })
})
