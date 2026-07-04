import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
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

const defaultNewMemberDraft = {
  name: '',
  isActive: true,
}

function MemberManagementPage({
  selectedGuild,
  trackedMembers,
  controlsRef,
  tableRef,
  mutationPending,
  canEdit = true,
  onCreateTrackedMember,
  onUpdateTrackedMember,
  onDeleteTrackedMember,
  fmtGold,
}) {
  const [newMemberDraft, setNewMemberDraft] = useState(defaultNewMemberDraft)
  const [rowDrafts, setRowDrafts] = useState({})
  const summary = useMemo(
    () => ({
      memberCount: trackedMembers.length,
      activeCount: trackedMembers.filter((member) => member.isActive).length,
      inactiveCount: trackedMembers.filter((member) => !member.isActive).length,
    }),
    [trackedMembers],
  )

  useEffect(() => {
    const nextDrafts = {}
    for (const member of trackedMembers) {
      nextDrafts[member.id] = {
        name: member.name,
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

  if (!selectedGuild) {
    return <Alert severity="info">Select a guild to manage members.</Alert>
  }

  return (
    <Stack spacing={3}>
      <Card ref={controlsRef}>
        <CardContent>
          <Typography variant="h6">Member Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage the roster for {selectedGuild.name}. Add members, rename them, and update who is active.
          </Typography>
          {!canEdit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Viewer access is read-only. Only admins and owners can update the roster.
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
            <Chip label={`Members: ${summary.memberCount}`} variant="outlined" />
            <Chip label={`Active: ${summary.activeCount}`} variant="outlined" />
            <Chip label={`Inactive: ${summary.inactiveCount}`} variant="outlined" />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Member name"
              value={newMemberDraft.name}
              disabled={!canEdit}
              onChange={(event) =>
                setNewMemberDraft((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <TextField
              select
              label="Roster status"
              value={newMemberDraft.isActive ? 'active' : 'inactive'}
              disabled={!canEdit}
              onChange={(event) =>
                setNewMemberDraft((prev) => ({ ...prev, isActive: event.target.value === 'active' }))
              }
              sx={{ minWidth: 180 }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </TextField>
            <Button
              variant="contained"
              disabled={mutationPending || !canEdit}
              onClick={async () => {
                const wasSaved = await onCreateTrackedMember({
                  name: newMemberDraft.name,
                  duesAmount: '',
                  useDefaultDues: true,
                  duesExempt: false,
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
        </CardContent>
      </Card>

      <Card ref={tableRef}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tracked Member Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This page is for roster changes only. Dues settings and payment tracking are on the dues page.
          </Typography>

          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Roster status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trackedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No tracked members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  trackedMembers.map((member) => {
                    const rowDraft = rowDrafts[member.id] || {
                      name: member.name,
                      isActive: Boolean(member.isActive),
                    }

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Stack spacing={0.5}>
                            <TextField
                              size="small"
                              value={rowDraft.name}
                              disabled={!canEdit}
                              onChange={(event) =>
                                setRowDrafts((prev) => ({
                                  ...prev,
                                  [member.id]: { ...rowDraft, name: event.target.value },
                                }))
                              }
                              inputProps={{ 'data-testid': `member-name-input-\${member.id}` }}
                            />
                            {fmtGold && (
                              <Typography variant="caption" color="text.secondary" component="span">
                                Dues: {fmtGold(member.duesAmount || 0)}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={rowDraft.isActive ? 'Active' : 'Inactive'}
                            color={rowDraft.isActive ? 'success' : 'default'}
                            variant={rowDraft.isActive ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="text"
                              disabled={mutationPending || !canEdit}
                              onClick={() =>
                                setRowDrafts((prev) => ({
                                  ...prev,
                                  [member.id]: { ...rowDraft, isActive: !rowDraft.isActive },
                                }))
                              }
                            >
                              Mark {rowDraft.isActive ? 'inactive' : 'active'}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={mutationPending || !canEdit}
                              onClick={() =>
                                onUpdateTrackedMember(member.id, {
                                  name: rowDraft.name,
                                  duesAmount: member.duesAmount,
                                  useDefaultDues: member.useDefaultDues !== false,
                                  duesExempt: Boolean(member.duesExempt),
                                  isActive: rowDraft.isActive,
                                })
                              }
                            >
                              Save
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              disabled={mutationPending || !canEdit}
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
    </Stack>
  )
}

export default MemberManagementPage