import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Chip,
  Stack,
  TextField,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { getGuildRecruitmentSettings, submitApplication } from '../api'

function PublicGuildProfile({ guildId, onBack, currentUser }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getGuildRecruitmentSettings(guildId)
        setSettings(response)
        setAnswers(new Array(response.applicationQuestions.length).fill(''))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [guildId])

  const handleAnswerChange = (index, value) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) {
      setError('You must be signed in to apply.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await submitApplication(guildId, answers)
      setSuccess('Your application has been submitted successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  if (!settings) {
    return (
      <Container maxWidth="md">
        <Alert severity="error">{error || 'Guild not found.'}</Alert>
        <Button onClick={onBack} sx={{ mt: 2 }}>Back to Discovery</Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md">
      <Button onClick={onBack} sx={{ mb: 3 }}>← Back to Discovery</Button>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: 'Palatino Linotype, serif' }}>
                {settings.guildName || 'Guild Profile'}
              </Typography>
              <Chip label={settings.focus} color="primary" size="small" sx={{ mt: 1 }} />
            </Box>
          </Stack>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Description
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 3 }}>
            {settings.description || 'No description provided.'}
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Requirements
          </Typography>
          {settings.requirements?.length > 0 ? (
            <List dense>
              {settings.requirements.map((req, index) => (
                <ListItem key={index}>
                  <ListItemText primary={`• ${req}`} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">No specific requirements listed.</Typography>
          )}
        </CardContent>
      </Card>

      {!success && (
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              Apply to Guild
            </Typography>

            {!currentUser && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                You must be signed in to submit an application.
              </Alert>
            )}

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={3}>
                {settings.applicationQuestions.map((question, index) => (
                  <TextField
                    key={index}
                    label={question}
                    multiline
                    minRows={2}
                    required
                    value={answers[index]}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    disabled={submitting || !currentUser}
                  />
                ))}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting || !currentUser || settings.applicationQuestions.length === 0 && !currentUser}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
                {settings.applicationQuestions.length === 0 && (
                   <Typography variant="body2" color="text.secondary" align="center">
                     This guild has no application questions. Just hit submit to express interest!
                   </Typography>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {success && (
        <Alert severity="success" variant="filled" sx={{ mt: 3 }}>
          {success}
        </Alert>
      )}
    </Container>
  )
}

export default PublicGuildProfile
