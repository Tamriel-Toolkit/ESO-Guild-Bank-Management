import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
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
  Typography,
} from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import BadgeIcon from '@mui/icons-material/Badge'
import GroupsIcon from '@mui/icons-material/Groups'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'

const defaultNewMemberDraft = {
  name: '',
  isActive: true,
  rankId: '',
}

function MemberManagementPage({
  selectedGuild,
  trackedMembers,
  ranks = [],
  controlsRef,
  tableRef,
  mutationPending,
  canEdit = true,
  onCreateTrackedMember,
  onUpdateTrackedMember,
  onDeleteTrackedMember,
<<<<<<< HEAD
  fmtGold,
=======
  onOpenRankManagement,
  onOpenCharacterManagement,
>>>>>>> origin/main
}) {
  const [newMemberDraft, setNewMemberDraft] = useState(defaultNewMemberDraft)
  const [rowDrafts, setRowDrafts] = useState({})
  const [filters, setFilters] = useState({ role: 'all', className: 'all', search: '' })
  const [sort, setSort] = useState({ column: 'name', direction: 'asc' })

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
        rankId: member.rankId || '',
      }
    }
    setRowDrafts(nextDrafts)
  }, [trackedMembers])

  const filteredMembers = useMemo(() => {
    return trackedMembers.filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(filters.search.toLowerCase())
      const characters = member.characters || []
      const matchesRole = filters.role === 'all' || characters.some(c => c.role === filters.role)
      const matchesClass = filters.className === 'all' || characters.some(c => c.class === filters.className)
      return matchesSearch && matchesRole && matchesClass
    }).sort((a, b) => {
      let valA, valB
      if (sort.column === 'name') {
        valA = a.name.toLowerCase()
        valB = b.name.toLowerCase()
      } else if (sort.column === 'lastActive') {
        valA = a.lastActiveAt || ''
        valB = b.lastActiveAt || ''
      }
      if (valA < valB) return sort.direction === 'asc' ? -1 : 1
      if (valA > valB) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [trackedMembers, filters, sort])

  if (!selectedGuild) {
    return <Alert severity="info">Select a guild to manage members.</Alert>
  }

  const handleSort = (column) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  return (
    <Stack spacing={3}>
      <Card ref={controlsRef}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Member Management</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage the roster for {selectedGuild.name}.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<BadgeIcon />}
              onClick={onOpenRankManagement}
              disabled={!canEdit}
              title="Manage Ranks"
            >
              Ranks
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
            <Chip label={`Members: ${summary.memberCount}`} variant="outlined" />
            <Chip label={`Active: ${summary.activeCount}`} variant="outlined" />
          </Stack>

          {!canEdit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Viewer access is read-only. Only admins and owners can update the roster.
            </Alert>
          )}

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
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Rank</InputLabel>
              <Select
                label="Rank"
                value={newMemberDraft.rankId}
                onChange={(e) => setNewMemberDraft(p => ({ ...p, rankId: e.target.value }))}
                disabled={!canEdit}
              >
                <MenuItem value="">None</MenuItem>
                {ranks.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              disabled={mutationPending || !canEdit}
              title="Add member"
              onClick={async () => {
                const wasSaved = await onCreateTrackedMember({
                  ...newMemberDraft,
                  duesAmount: '',
                  useDefaultDues: true,
                  duesExempt: false,
                })
                if (wasSaved) setNewMemberDraft(defaultNewMemberDraft)
              }}
            >
              Add Member
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Filters</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Search members"
                value={filters.search}
                onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel id="filter-role-label">Filter by Role</InputLabel>
                <Select
                  labelId="filter-role-label"
                  label="Filter by Role"
                  value={filters.role}
                  onChange={(e) => setFilters(p => ({ ...p, role: e.target.value }))}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="Tank">Tank</MenuItem>
                  <MenuItem value="Healer">Healer</MenuItem>
                  <MenuItem value="DPS">DPS</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel id="filter-class-label">Filter by Class</InputLabel>
                <Select
                  labelId="filter-class-label"
                  label="Filter by Class"
                  value={filters.className}
                  onChange={(e) => setFilters(p => ({ ...p, className: e.target.value }))}
                >
                  <MenuItem value="all">All Classes</MenuItem>
                  {['Dragonknight', 'Sorcerer', 'Nightblade', 'Templar', 'Warden', 'Necromancer', 'Arcanist'].map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card ref={tableRef}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sort.column === 'name'}
                      direction={sort.column === 'name' ? sort.direction : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      Member
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Rank</TableCell>
                  <TableCell>Characters</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sort.column === 'lastActive'}
                      direction={sort.column === 'lastActive' ? sort.direction : 'asc'}
                      onClick={() => handleSort('lastActive')}
                    >
                      Last Active
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMembers.map((member) => {
                  const rowDraft = rowDrafts[member.id] || {
                    name: member.name,
                    isActive: Boolean(member.isActive),
                    rankId: member.rankId || '',
                  }
                  const primaryChar = member.characters?.find(c => c.isPrimary) || member.characters?.[0]

<<<<<<< HEAD
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
=======
                  return (
                    <TableRow key={member.id} sx={{ opacity: member.isActive ? 1 : 0.6 }}>
                      <TableCell>
                        <TextField
                          size="small"
                          variant="standard"
                          value={rowDraft.name}
                          disabled={!canEdit}
                          onChange={(e) => setRowDrafts(p => ({ ...p, [member.id]: { ...rowDraft, name: e.target.value } }))}
                          onBlur={() => {
                            if (rowDraft.name !== member.name) {
                              onUpdateTrackedMember(member.id, { ...member, name: rowDraft.name })
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={rowDraft.rankId}
                          onChange={(e) => {
                            const nextRankId = e.target.value
                            setRowDrafts(p => ({ ...p, [member.id]: { ...rowDraft, rankId: nextRankId } }))
                            onUpdateTrackedMember(member.id, { ...member, rankId: nextRankId })
                          }}
                          disabled={!canEdit}
                          variant="standard"
                          sx={{ minWidth: 100 }}
                        >
                          <MenuItem value="">None</MenuItem>
                          {ranks.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {primaryChar ? (
                            <Chip
>>>>>>> origin/main
                              size="small"
                              label={`${primaryChar.name} (${primaryChar.class} ${primaryChar.role})`}
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">None</Typography>
                          )}
                          <IconButton size="small" onClick={() => onOpenCharacterManagement(member)} title="Characters" aria-label="Characters">
                            <GroupsIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleDateString() : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => onUpdateTrackedMember(member.id, { ...member, isActive: !member.isActive })}
                            disabled={!canEdit}
                            title={member.isActive ? 'Mark inactive' : 'Mark active'}
                          >
                            {member.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={!canEdit}
                            onClick={() => onDeleteTrackedMember(member)}
                            title="Delete Member"
                            aria-label="Delete Member"
                          >
                            <ManageAccountsIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default MemberManagementPage
