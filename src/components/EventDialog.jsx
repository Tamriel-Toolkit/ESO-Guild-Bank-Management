import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert
} from '@mui/material'

const eventTypes = [
  { value: 'trial', label: 'Trial / Raid' },
  { value: 'dungeon', label: 'Dungeon' },
  { value: 'pvp', label: 'PvP Night' },
  { value: 'social', label: 'Social Event' },
  { value: 'other', label: 'Other' }
]

const recurrenceOptions = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }
]

function EventDialog({ open, onClose, onSave, event = null, initialDate = null }) {
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    maxParticipants: 12,
    eventType: 'trial',
    recurrenceRule: 'none'
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (event) {
      setDraft({
        title: event.title,
        description: event.description,
        startTime: event.startTime.slice(0, 16), // Format for datetime-local
        endTime: event.endTime.slice(0, 16),
        maxParticipants: event.maxParticipants,
        eventType: event.eventType,
        recurrenceRule: event.recurrenceRule
      })
    } else if (initialDate) {
      const start = new Date(initialDate)
      start.setHours(20, 0, 0, 0)
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
      setDraft((prev) => ({
        ...prev,
        startTime: start.toISOString().slice(0, 16),
        endTime: end.toISOString().slice(0, 16)
      }))
    }
  }, [event, initialDate, open])

  const handleSave = async () => {
    setError('')
    try {
      await onSave(draft)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            fullWidth
            label="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              type="datetime-local"
              label="Start Time"
              InputLabelProps={{ shrink: true }}
              value={draft.startTime}
              onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
            />
            <TextField
              fullWidth
              type="datetime-local"
              label="End Time"
              InputLabelProps={{ shrink: true }}
              value={draft.endTime}
              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              select
              label="Event Type"
              value={draft.eventType}
              onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}
            >
              {eventTypes.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              type="number"
              label="Max Participants"
              value={draft.maxParticipants}
              onChange={(e) => setDraft({ ...draft, maxParticipants: Number(e.target.value) })}
            />
          </Stack>
          <TextField
            fullWidth
            select
            label="Recurrence"
            value={draft.recurrenceRule}
            onChange={(e) => setDraft({ ...draft, recurrenceRule: e.target.value })}
          >
            {recurrenceOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

export default EventDialog
