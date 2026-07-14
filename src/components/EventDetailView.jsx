import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Divider,
  Box
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { PieChart } from '@mui/x-charts/PieChart'
import { getSignupsForEvent, createSignupForEvent, updateSignup, deleteSignup, getCharactersForMember } from '../api'

const roles = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'dps', label: 'DPS' }
]

function EventDetailView({ open, onClose, guildId, event, occurrenceDate, trackedMembers, canEdit }) {
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [memberCharacters, setMemberCharacters] = useState([])
  const [signupDraft, setSignupDraft] = useState({
    characterId: '',
    role: 'dps',
    status: 'confirmed'
  })

  useEffect(() => {
    if (open && event) {
      loadSignups()
    }
  }, [open, event, occurrenceDate])

  useEffect(() => {
    if (selectedMember) {
      loadMemberCharacters(selectedMember)
    } else {
      setMemberCharacters([])
    }
  }, [selectedMember])

  const loadSignups = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getSignupsForEvent(guildId, event.id, occurrenceDate)
      setSignups(response.signups || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMemberCharacters = async (memberId) => {
    try {
      const response = await getCharactersForMember(memberId)
      const chars = response.characters || []
      setMemberCharacters(chars)
      if (chars.length > 0) {
        setSignupDraft(prev => ({ ...prev, characterId: chars[0].id }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSignup = async () => {
    if (!selectedMember || !signupDraft.characterId) return
    setError('')
    try {
      await createSignupForEvent(guildId, event.id, {
        occurrenceDate,
        trackedMemberId: selectedMember,
        ...signupDraft
      })
      setSelectedMember('')
      loadSignups()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateStatus = async (signupId, status) => {
    try {
      await updateSignup(signupId, { status })
      loadSignups()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateAttendance = async (signupId, attendance) => {
    try {
      await updateSignup(signupId, { attendance })
      loadSignups()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteSignup = async (signupId) => {
    if (!window.confirm('Remove this signup?')) return
    try {
      await deleteSignup(signupId)
      loadSignups()
    } catch (err) {
      setError(err.message)
    }
  }

  const roleStats = useMemo(() => {
    const stats = { tank: 0, healer: 0, dps: 0 }
    signups.filter(s => s.status === 'confirmed').forEach(s => {
      if (stats[s.role] !== undefined) stats[s.role]++
    })
    return stats
  }, [signups])

  const pieData = useMemo(() => [
    { id: 0, value: roleStats.tank, label: 'Tanks', color: '#1976d2' },
    { id: 1, value: roleStats.healer, label: 'Healers', color: '#2e7d32' },
    { id: 2, value: roleStats.dps, label: 'DPS', color: '#d32f2f' }
  ].filter(d => d.value > 0), [roleStats])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{event?.title} - {occurrenceDate}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body1">{event?.description || 'No description provided.'}</Typography>

          <Divider />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{
            alignItems: "center"
          }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Role Composition ({signups.filter(s => s.status === 'confirmed').length} / {event?.maxParticipants || '∞'})</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Chip label={`Tanks: ${roleStats.tank}`} color="primary" />
                <Chip label={`Healers: ${roleStats.healer}`} color="success" />
                <Chip label={`DPS: ${roleStats.dps}`} color="error" />
              </Stack>
            </Box>
            {pieData.length > 0 && (
              <PieChart
                series={[{ data: pieData }]}
                width={300}
                height={150}
              />
            )}
          </Stack>

          <Divider />

          <Typography variant="h6">Sign-ups</Typography>

          {canEdit && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                select
                label="Member"
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                sx={{ minWidth: 200 }}
                size="small"
              >
                {trackedMembers.filter(m => m.isActive).map(m => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Character"
                value={signupDraft.characterId}
                onChange={(e) => setSignupDraft({ ...signupDraft, characterId: e.target.value })}
                sx={{ minWidth: 150 }}
                disabled={!selectedMember}
                size="small"
              >
                {memberCharacters.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Role"
                value={signupDraft.role}
                onChange={(e) => setSignupDraft({ ...signupDraft, role: e.target.value })}
                sx={{ minWidth: 100 }}
                size="small"
              >
                {roles.map(r => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={handleSignup} disabled={!selectedMember || !signupDraft.characterId}>
                Sign Up
              </Button>
            </Stack>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Character</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Attendance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {signups.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center">No sign-ups yet.</TableCell></TableRow>
                ) : (
                  signups.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.memberName}</TableCell>
                      <TableCell>{s.characterName}</TableCell>
                      <TableCell>
                        <Chip label={s.role.toUpperCase()} size="small" color={s.role === 'tank' ? 'primary' : s.role === 'healer' ? 'success' : 'error'} />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={s.status}
                          disabled={!canEdit}
                          onChange={(e) => handleUpdateStatus(s.id, e.target.value)}
                        >
                          <MenuItem value="confirmed">Confirmed</MenuItem>
                          <MenuItem value="waitlist">Waitlist</MenuItem>
                          <MenuItem value="declined">Declined</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={s.attendance}
                          disabled={!canEdit}
                          onChange={(e) => handleUpdateAttendance(s.id, e.target.value)}
                        >
                          <MenuItem value="none">—</MenuItem>
                          <MenuItem value="present">Present</MenuItem>
                          <MenuItem value="no-show">No Show</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleDeleteSignup(s.id)} disabled={!canEdit} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default EventDetailView
