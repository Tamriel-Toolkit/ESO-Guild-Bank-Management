import { useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Stack,
  TextField,
  Typography,
  Divider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'

function RankManagementDialog({
  open,
  onClose,
  ranks,
  onCreateRank,
  onUpdateRank,
  onDeleteRank,
  mutationPending,
}) {
  const [editingRank, setEditingRank] = useState(null)
  const [draft, setDraft] = useState({ name: '', weight: 0, permissions: {} })

  const handleSave = async () => {
    if (editingRank) {
      const success = await onUpdateRank(editingRank.id, draft)
      if (success) {
        setEditingRank(null)
        setDraft({ name: '', weight: 0, permissions: {} })
      }
    } else {
      const success = await onCreateRank(draft)
      if (success) {
        setDraft({ name: '', weight: 0, permissions: {} })
      }
    }
  }

  const handleEdit = (rank) => {
    setEditingRank(rank)
    setDraft({ name: rank.name, weight: rank.weight, permissions: rank.permissions || {} })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Guild Rank Management</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Stack spacing={2} sx={{ p: 2, border: '1px solid rgba(199, 161, 93, 0.2)', borderRadius: 2 }}>
            <Typography variant="subtitle2">{editingRank ? 'Edit Rank' : 'Add New Rank'}</Typography>
            <TextField
              label="Rank Name"
              size="small"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextField
              label="Weight (Order)"
              type="number"
              size="small"
              value={draft.weight}
              onChange={(e) => setDraft({ ...draft, weight: parseInt(e.target.value, 10) || 0 })}
              helperText="Lower numbers appear higher in lists."
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(draft.permissions?.canManageEvents)}
                  onChange={(e) => setDraft({
                    ...draft,
                    permissions: { ...draft.permissions, canManageEvents: e.target.checked }
                  })}
                />
              }
              label="Can Manage Events"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleSave} disabled={mutationPending}>
                {editingRank ? 'Update Rank' : 'Add Rank'}
              </Button>
              {editingRank && (
                <Button size="small" onClick={() => { setEditingRank(null); setDraft({ name: '', weight: 0, permissions: {} }) }}>
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>

          <Divider />

          <List>
            {ranks.map((rank) => (
              <ListItem key={rank.id}>
                <ListItemText primary={rank.name} secondary={`Weight: ${rank.weight}`} />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => handleEdit(rank)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => onDeleteRank(rank.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {ranks.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                No custom ranks defined yet.
              </Typography>
            )}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default RankManagementDialog
