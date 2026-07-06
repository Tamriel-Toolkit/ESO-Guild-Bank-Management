import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MemberManagementPage from './MemberManagementPage'

function renderPage(overrides = {}) {
  const props = {
    selectedGuild: { id: 'guild-1', name: 'Test Guild', dueScheme: 'monthly', defaultDuesAmount: 2000 },
    trackedMembers: [],
    mutationPending: false,
    onCreateTrackedMember: vi.fn().mockResolvedValue(true),
    onUpdateTrackedMember: vi.fn().mockResolvedValue(true),
    onDeleteTrackedMember: vi.fn(),
    ...overrides,
  }

  render(<MemberManagementPage {...props} />)
  return props
}

describe('MemberManagementPage', () => {
  it('shows an informational message when no guild is selected', () => {
    renderPage({ selectedGuild: null })

    expect(screen.getByText('Select a guild to manage members.')).toBeInTheDocument()
  })

  it('adds a roster member with default dues settings preserved in the payload', async () => {
    const user = userEvent.setup()
    const onCreateTrackedMember = vi.fn().mockResolvedValue(true)

    renderPage({
      onCreateTrackedMember,
    })

    await user.type(screen.getByLabelText('Member name'), 'Roster Member')
    await user.click(screen.getByRole('button', { name: 'Add Member' }))

    await waitFor(() => {
      expect(onCreateTrackedMember).toHaveBeenCalledWith({
        name: 'Roster Member',
        duesAmount: '',
        useDefaultDues: true,
        duesExempt: false,
        isActive: true,
        rankId: '',
      })
    })
  })

  it('updates roster activity without changing saved dues settings', async () => {
    const user = userEvent.setup()
    const onUpdateTrackedMember = vi.fn().mockResolvedValue(true)

    renderPage({
      trackedMembers: [
        { id: 'member-1', name: 'Bravo', duesAmount: 3200, useDefaultDues: false, duesExempt: true, isActive: true },
      ],
      onUpdateTrackedMember,
    })

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(onUpdateTrackedMember).toHaveBeenCalledWith('member-1', {
        id: 'member-1',
        name: 'Bravo',
        duesAmount: 3200,
        useDefaultDues: false,
        duesExempt: true,
        isActive: false,
      })
    })
  })

  it('renders roster controls as read-only for viewer access', () => {
    renderPage({ canEdit: false })

    expect(screen.getByText('Viewer access is read-only. Only admins and owners can update the roster.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Member' })).toBeDisabled()
  })

  it('renders ranks in the rank selection dropdowns', async () => {
    const user = userEvent.setup()
    const ranks = [
      { id: 'rank-1', name: 'Officer' },
      { id: 'rank-2', name: 'Veteran' },
    ]

    renderPage({
      ranks,
      trackedMembers: [
        { id: 'member-1', name: 'Alice', rankId: 'rank-1', isActive: true },
      ],
    })

    // Check rank for new member draft
    const newMemberRankSelect = screen.getByLabelText('Rank')
    await user.click(newMemberRankSelect)
    expect(screen.getByRole('option', { name: 'Officer' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Veteran' })).toBeInTheDocument()

    // Close the select menu to avoid interference with the next check
    await user.keyboard('{Escape}')

    // Check rank for existing member in the table
    // The Select in the table doesn't have a label, so we find it by its current value or within the row
    const row = screen.getByRole('row', { name: /Alice/ })
    const memberRankSelect = within(row).getByRole('combobox')
    await user.click(memberRankSelect)

    // MUI Select uses a portal for options, so they might be anywhere in the document
    expect(screen.getByRole('option', { name: 'Officer' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Veteran' })).toBeInTheDocument()
  })
})