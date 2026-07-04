import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
  Alert,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { getGuildRecruitmentSettings, updateGuildRecruitmentSettings } from '../api'

function RecruitmentSettings({ guildId, canEdit }) {
  const [settings, setSettings] = useState({
    isPublic: false,
    description: '',
    focus: 'PvE',
    requirements: [],
    applicationQuestions: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getGuildRecruitmentSettings(guildId)
        setSettings(response)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (guildId) fetchSettings()
  }, [guildId])

  const handleSave = async () => {
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      await updateGuildRecruitmentSettings(guildId, settings)
      setNotice('Recruitment settings saved successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddRequirement = () => {
    setSettings({ ...settings, requirements: [...settings.requirements, ''] })
  }

  const handleUpdateRequirement = (index, value) => {
    const nextRequirements = [...settings.requirements]
    nextRequirements[index] = value
    setSettings({ ...settings, requirements: nextRequirements })
  }

  const handleRemoveRequirement = (index) => {
    setSettings({
      ...settings,
      requirements: settings.requirements.filter((_, i) => i !== index),
    })
  }

  const handleAddQuestion = () => {
    setSettings({ ...settings, applicationQuestions: [...settings.applicationQuestions, ''] })
  }

  const handleUpdateQuestion = (index, value) => {
    const nextQuestions = [...settings.applicationQuestions]
    nextQuestions[index] = value
    setSettings({ ...settings, applicationQuestions: nextQuestions })
  }

  const handleRemoveQuestion = (index) => {
    setSettings({
      ...settings,
      applicationQuestions: settings.applicationQuestions.filter((_, i) => i !== index),
    })
  }

  if (loading) return <Typography>Loading recruitment settings...</Typography>

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" gutterBottom sx={{ fontFamily: 'Palatino Linotype, serif' }} data-testid="recruitment-settings-title">
          Recruitment Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure how your guild appears in the discovery list and what information you want from applicants.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.isPublic}
                  disabled={!canEdit}
                  onChange={(e) => setSettings({ ...settings, isPublic: e.target.checked })}
                />
              }
              label="Enable Public Recruitment"
            />

            <FormControl fullWidth>
              <InputLabel id="guild-focus-label">Guild Focus</InputLabel>
              <Select
                labelId="guild-focus-label"
                value={settings.focus}
                label="Guild Focus"
                disabled={!canEdit}
                onChange={(e) => setSettings({ ...settings, focus: e.target.value })}
              >
                <MenuItem value="PvE">PvE</MenuItem>
                <MenuItem value="PvP">PvP</MenuItem>
                <MenuItem value="Trading">Trading</MenuItem>
                <MenuItem value="Social">Social</MenuItem>
                <MenuItem value="All-rounder">All-rounder</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Guild Description"
              multiline
              minRows={4}
              fullWidth
              value={settings.description}
              disabled={!canEdit}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              placeholder="Tell prospective members what your guild is all about..."
            />

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom>
                Requirements
              </Typography>
              <Stack spacing={1}>
                {settings.requirements.map((req, index) => (
                  <Stack key={index} direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      value={req}
                      disabled={!canEdit}
                      onChange={(e) => handleUpdateRequirement(index, e.target.value)}
                      placeholder="e.g. CP 160+, Level 50, Discord required..."
                    />
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveRequirement(index)}
                      disabled={!canEdit}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddRequirement}
                  disabled={!canEdit}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add Requirement
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom>
                Application Questions
              </Typography>
              <Stack spacing={1}>
                {settings.applicationQuestions.map((q, index) => (
                  <Stack key={index} direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      value={q}
                      disabled={!canEdit}
                      onChange={(e) => handleUpdateQuestion(index, e.target.value)}
                      placeholder="e.g. What is your primary role (Tank/Healer/DPS)?"
                    />
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveQuestion(index)}
                      disabled={!canEdit}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddQuestion}
                  disabled={!canEdit}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add Question
                </Button>
              </Stack>
            </Box>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!canEdit || submitting}
              sx={{ alignSelf: 'flex-end' }}
            >
              {submitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default RecruitmentSettings
