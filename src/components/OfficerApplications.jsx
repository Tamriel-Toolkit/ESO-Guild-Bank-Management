import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
  Alert,
  TextField,
  Grid,
  CircularProgress,
  MenuItem,
} from '@mui/material'
import { getGuildApplications, reviewApplication } from '../api'
import { formatDisplayDate } from '../utils/dateFormatting'

function OfficerApplications({ guildId, canEdit, onApplicationReviewed }) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewDraft, setReviewDraft] = useState({ status: '', reviewerNotes: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const response = await getGuildApplications(guildId)
      setApplications(response.applications || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (guildId) fetchApplications()
  }, [guildId])

  const handleOpenReview = (app) => {
    setReviewingId(app.id)
    setReviewDraft({ status: app.status, reviewerNotes: app.reviewerNotes || '' })
  }

  const handleSaveReview = async (applicationId) => {
    setSubmitting(true)
    try {
      const response = await reviewApplication(guildId, applicationId, reviewDraft)
      setReviewingId(null)
      fetchApplications()
      if (onApplicationReviewed && response.user) {
        onApplicationReviewed(response.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" gutterBottom sx={{ fontFamily: 'Palatino Linotype, serif' }}>
          Applicant Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review prospective members and manage their application status.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {applications.length === 0 ? (
        <Alert severity="info">No applications received yet.</Alert>
      ) : (
        <Stack spacing={2}>
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6">{app.applicantUsername}</Typography>
                      <Chip label={app.status.toUpperCase()} size="small" color={getStatusColor(app.status)} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      Submitted on {formatDisplayDate(app.createdAt.slice(0, 10))}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>Application Answers:</Typography>
                    {app.answers?.map((answer, index) => (
                      <Box key={index} sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Question {index + 1}:
                        </Typography>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{answer || '—'}</Typography>
                      </Box>
                    ))}
                  </Grid>

                  <Grid item xs={12} md={4} sx={{ borderLeft: { md: '1px solid rgba(199, 161, 93, 0.16)' } }}>
                    {reviewingId === app.id ? (
                      <Stack spacing={2}>
                        <Typography variant="subtitle1">Review Application</Typography>
                        <TextField
                          select
                          label="Status"
                          fullWidth
                          size="small"
                          value={reviewDraft.status}
                          onChange={(e) => setReviewDraft({ ...reviewDraft, status: e.target.value })}
                        >
                          <MenuItem value="pending">Pending</MenuItem>
                          <MenuItem value="reviewed">Reviewed</MenuItem>
                          <MenuItem value="accepted">Accepted (Add to Guild)</MenuItem>
                          <MenuItem value="rejected">Rejected</MenuItem>
                        </TextField>
                        <TextField
                          label="Officer Notes"
                          multiline
                          minRows={3}
                          fullWidth
                          value={reviewDraft.reviewerNotes}
                          onChange={(e) => setReviewDraft({ ...reviewDraft, reviewerNotes: e.target.value })}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            fullWidth
                            onClick={() => handleSaveReview(app.id)}
                            disabled={submitting || !canEdit}
                          >
                            {submitting ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => setReviewingId(null)}
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack spacing={2}>
                        <Typography variant="subtitle1">Reviewer Notes:</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontStyle: app.reviewerNotes ? 'normal' : 'italic' }}>
                          {app.reviewerNotes || 'No notes yet.'}
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => handleOpenReview(app)}
                          disabled={!canEdit}
                        >
                          {app.reviewerNotes || app.status !== 'pending' ? 'Edit Review' : 'Start Review'}
                        </Button>
                      </Stack>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export default OfficerApplications
