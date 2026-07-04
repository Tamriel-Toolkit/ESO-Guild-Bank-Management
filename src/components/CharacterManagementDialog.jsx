import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Divider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'

const classes = ['Dragonknight', 'Sorcerer', 'Nightblade', 'Templar', 'Warden', 'Necromancer', 'Arcanist']
const roles = ['Tank', 'Healer', 'DPS']

function CharacterManagementDialog({
  open,
  onClose,
  member,
  onCreateCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  mutationPending,
}) {
  const [editingChar, setEditingChar] = useState(null)
  const [draft, setDraft] = useState({ name: '', class: '', role: '', level: 50, isPrimary: false })

  const handleSave = async () => {
    if (editingChar) {
      const success = await onUpdateCharacter(member.id, editingChar.id, draft)
      if (success) setEditingChar(null)
    } else {
      const success = await onCreateCharacter(member.id, draft)
      if (success) setDraft({ name: '', class: '', role: '', level: 50, isPrimary: false })
    }
  }

  if (!member) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Characters for {member.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Stack spacing={2} sx={{ p: 2, border: '1px solid rgba(199, 161, 93, 0.2)', borderRadius: 2 }}>
            <Typography variant="subtitle2">{editingChar ? 'Edit Character' : 'Add New Character'}</Typography>
            <TextField
              label="Character Name"
              size="small"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                fullWidth
                label="Class"
                size="small"
                value={draft.class}
                onChange={(e) => setDraft({ ...draft, class: e.target.value })}
              >
                {classes.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField
                select
                fullWidth
                label="Role"
                size="small"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                {roles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField
              label="Level"
              type="number"
              size="small"
              value={draft.level}
              onChange={(e) => setDraft({ ...draft, level: e.target.value })}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleSave} disabled={mutationPending}>
                {editingChar ? 'Update' : 'Add'}
              </Button>
              {editingChar && (
                <Button size="small" onClick={() => { setEditingChar(null); setDraft({ name: '', class: '', role: '', level: 50, isPrimary: false }) }}>
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>

          <Divider />

          <List>
            {(member.characters || []).map((char) => (
              <ListItem key={char.id}>
                <ListItemText
                  primary={char.name}
                  secondary={`${char.class} | ${char.role} | Lvl ${char.level}`}
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => { setEditingChar(char); setDraft({ name: char.name, class: char.class, role: char.role, level: char.level, isPrimary: char.isPrimary }) }}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => onDeleteCharacter(member.id, char.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default CharacterManagementDialog
