import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Stack,
  Alert
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { getCharactersForMember, createCharacterForMember, deleteCharacterFromMember } from '../api'

function CharacterManager({ open, onClose, memberId, memberName }) {
  const [characters, setCharacters] = useState([])
  const [newCharacterName, setNewCharacterName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && memberId) {
      loadCharacters()
    }
  }, [open, memberId])

  const loadCharacters = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getCharactersForMember(memberId)
      setCharacters(response.characters || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCharacter = async () => {
    if (!newCharacterName.trim()) return
    setError('')
    try {
      await createCharacterForMember(memberId, newCharacterName.trim())
      setNewCharacterName('')
      loadCharacters()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteCharacter = async (characterId) => {
    if (!window.confirm('Delete this character?')) return
    setError('')
    try {
      await deleteCharacterFromMember(memberId, characterId)
      loadCharacters()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manage Characters for {memberName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="New Character Name"
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value)}
            />
            <Button variant="contained" onClick={handleAddCharacter} disabled={!newCharacterName.trim()}>
              Add
            </Button>
          </Stack>
          <Typography variant="subtitle2">Existing Characters:</Typography>
          <List dense>
            {characters.length === 0 ? (
              <ListItem><ListItemText secondary="No characters added yet." /></ListItem>
            ) : (
              characters.map((char) => (
                <ListItem
                  key={char.id}
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteCharacter(char.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText primary={char.name} />
                </ListItem>
              ))
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

export default CharacterManager
