import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DuesDashboardPage from './DuesDashboardPage'

const fmtGold = (value) => `${Math.round(value).toLocaleString()}g`

function renderPage(overrides = {}) {
  const props = {
    selectedGuild: { id: 'guild-1', name: 'Test Guild', dueScheme: 'monthly', defaultDuesAmount: 2000 },
    entries: [],
    trackedMembers: [],
    mutationPending: false,
    onUpdateGuildDuesSettings: vi.fn().mockResolvedValue(true),
    onCreateTrackedMember: vi.fn().mockResolvedValue(true),
    onUpdateTrackedMember: vi.fn().mockResolvedValue(true),
    onDeleteTrackedMember: vi.fn(),
    fmtGold,
    ...overrides,
  }

  render(<DuesDashboardPage {...props} />)
  return props
}

describe('DuesDashboardPage', () => {
  it('shows an informational message when no guild is selected', () => {
    renderPage({ selectedGuild: null })

    expect(screen.getByText('Choose a guild before opening member management.')).toBeInTheDocument()
  })

  it('excludes permanently exempt members from expected dues totals', () => {
    renderPage({
      trackedMembers: [
        { id: 'member-1', name: 'Paid Member', duesAmount: 0, useDefaultDues: true, duesExempt: false, isActive: true },
        { id: 'member-2', name: 'Exempt Member', duesAmount: 5000, useDefaultDues: false, duesExempt: true, isActive: true },
      ],
    })

    expect(screen.getByText('Expected: 2,000g')).toBeInTheDocument()
    expect(screen.getByText('Excluded: 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Exempt Member')).toBeInTheDocument()
    expect(screen.getAllByText('Excluded')[0]).toBeInTheDocument()
  })

  it('invokes the guild dues settings handler when the shared scheme changes', async () => {
    const user = userEvent.setup()
    const onUpdateGuildDuesSettings = vi.fn().mockResolvedValue(true)

    renderPage({
      onUpdateGuildDuesSettings,
    })

    await user.click(screen.getByRole('combobox', { name: 'Dues scheme' }))
    await user.click(await screen.findByRole('option', { name: 'Weekly' }))

    expect(onUpdateGuildDuesSettings).toHaveBeenCalledWith({ dueScheme: 'weekly' })
  })

  it('sends the guild-default flag and exemption state when adding a member', async () => {
    const user = userEvent.setup()
    const onCreateTrackedMember = vi.fn().mockResolvedValue(true)

    renderPage({
      selectedGuild: { id: 'guild-1', name: 'Weekly Guild', dueScheme: 'weekly', defaultDuesAmount: 2500 },
      onCreateTrackedMember,
    })

    await user.type(screen.getByLabelText('Member name'), 'Roster Member')
    await user.click(screen.getByRole('checkbox', { name: 'Permanently excluded from dues' }))
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    await waitFor(() => {
      expect(onCreateTrackedMember).toHaveBeenCalledWith({
        name: 'Roster Member',
        duesAmount: '',
        useDefaultDues: true,
        duesExempt: true,
        isActive: true,
      })
    })
  })

  it('updates the guild default dues amount from the dashboard', async () => {
    const user = userEvent.setup()
    const onUpdateGuildDuesSettings = vi.fn().mockResolvedValue(true)

    renderPage({ onUpdateGuildDuesSettings })

    const defaultField = screen.getByLabelText('Default dues amount')
    await user.click(defaultField)
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    await user.type(defaultField, '3500')
    await user.click(screen.getByRole('button', { name: 'Apply default' }))

    expect(onUpdateGuildDuesSettings).toHaveBeenCalledWith({ defaultDuesAmount: '3500' })
  })
})