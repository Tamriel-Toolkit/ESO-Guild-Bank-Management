import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material'
import { getPublicGuilds } from '../api'

function GuildDiscoveryPage({ onSelectGuild }) {
  const [guilds, setGuilds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchGuilds = async () => {
      try {
        const response = await getPublicGuilds()
        setGuilds(response.guilds || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchGuilds()
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Palatino Linotype, serif' }}>
          Guild Discovery
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse guilds that are currently recruiting and find your next home in Tamriel.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {guilds.length === 0 ? (
        <Alert severity="info">No guilds are currently recruiting publicly.</Alert>
      ) : (
        <Grid container spacing={3}>
          {guilds.map((guild) => (
            <Grid item xs={12} sm={6} md={4} key={guild.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                    {guild.name}
                  </Typography>
                  <Chip
                    label={guild.focus}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      mb: 2,
                    }}
                  >
                    {guild.description || 'No description provided.'}
                  </Typography>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => onSelectGuild(guild.id)}
                  >
                    View Profile
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  )
}

export default GuildDiscoveryPage
