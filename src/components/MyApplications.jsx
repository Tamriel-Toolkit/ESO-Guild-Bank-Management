import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import { getMyApplications } from '../api'
import { formatDisplayDate } from '../utils/dateFormatting'

function MyApplications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchMyApplications = async () => {
      try {
        const response = await getMyApplications()
        setApplications(response.applications || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchMyApplications()
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'success'
      case 'rejected': return 'error'
      case 'reviewed': return 'warning'
      default: return 'info'
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  return (
    <Container maxWidth="md">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Palatino Linotype, serif' }}>
          My Applications
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track the status of your guild applications.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {applications.length === 0 ? (
        <Alert severity="info">You haven't submitted any applications yet.</Alert>
      ) : (
        <Stack spacing={2}>
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6">{app.guildName}</Typography>
                  <Chip
                    label={app.status.toUpperCase()}
                    color={getStatusColor(app.status)}
                    size="small"
                  />
                </Stack>

                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  Applied on {formatDisplayDate(app.createdAt.slice(0, 10))}
                </Typography>

                {app.reviewerNotes && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(199, 161, 93, 0.05)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Reviewer Feedback:</Typography>
                    <Typography variant="body2">{app.reviewerNotes}</Typography>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>Your Answers:</Typography>
                {app.answers?.map((answer, index) => (
                   <Box key={index} sx={{ mb: 1 }}>
                     <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{answer || '—'}</Typography>
                   </Box>
                ))}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  )
}

export default MyApplications
