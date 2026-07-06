import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ExploreIcon from '@mui/icons-material/Explore'
import PaymentsIcon from '@mui/icons-material/Payments'

function WelcomePage({ onOpenAuth, onNavigate }) {
  const features = [
    {
      title: 'Gold Ledger',
      description: 'Transparently track every deposit, withdrawal, and sales tax entry with member-linked records.',
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      title: 'Dues Management',
      description: 'Automate tracking of member contributions with flexible weekly or monthly dues schedules.',
      icon: <PaymentsIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      title: 'Roster Management',
      description: 'Maintain a detailed roster with character roles, levels, and customizable guild ranks.',
      icon: <AssignmentIndIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      title: 'Event Calendar',
      description: 'Coordinate trials, raids, and social events with automated sign-ups and waitlisting.',
      icon: <CalendarMonthIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      title: 'Guild Discovery',
      description: 'Find new members or a new home via the public portal for guild profiles and applications.',
      icon: <ExploreIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      {/* Hero Section */}
      <Box className="eso-hero-banner" sx={{ mb: 6, textAlign: 'center', py: { xs: 4, md: 6 } }}>
        <Typography variant="overline" className="eso-hero-kicker" sx={{ display: 'block', mb: 1 }}>
          The Definitive Guild Management Suite
        </Typography>
        <Typography variant="h3" component="h1" className="eso-hero-title" sx={{ mb: 2 }}>
          Master Your Guild's Fortune
        </Typography>
        <Typography variant="h6" className="eso-hero-subtitle" sx={{ mx: 'auto', mb: 4, maxWidth: '800px' }}>
          Streamline finances, organize events, and manage your roster with the professional-grade ledger designed specifically for Elder Scrolls Online guilds.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          sx={{ mt: 4 }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => onOpenAuth('signup')}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
          >
            Get Started
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => onNavigate('discovery')}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
          >
            Browse Guilds
          </Button>
        </Stack>
      </Box>

      {/* Feature Highlights */}
      <Typography variant="h4" textAlign="center" gutterBottom sx={{ mb: 4 }}>
        Built for Guild Leaders, by Guild Leaders
      </Typography>
      <Grid container spacing={3} sx={{ mb: 8 }}>
        {features.map((feature) => (
          <Grid item xs={12} sm={6} md={4} key={feature.title}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 4 }}>
                <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Action Hub / CTAs */}
      <Card sx={{ p: { xs: 3, md: 6 }, textAlign: 'center', background: 'linear-gradient(180deg, rgba(36, 30, 24, 0.98), rgba(25, 21, 17, 0.98))' }}>
        <Typography variant="h4" gutterBottom>
          Ready to Elevate Your Guild?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
          Join hundreds of ESO guilds already using the Gold Ledger to achieve financial transparency and operational excellence.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          justifyContent="center"
          alignItems="center"
        >
          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, textTransform: 'uppercase' }}>
              Secure Your Data
            </Typography>
            <Button
              variant="contained"
              onClick={() => onOpenAuth('signup')}
              sx={{ minWidth: 200 }}
            >
              Create Free Account
            </Button>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
              Already a Member?
            </Typography>
            <Button
              variant="outlined"
              onClick={() => onOpenAuth('login')}
              sx={{ minWidth: 200 }}
            >
              Sign In
            </Button>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
              Explore First
            </Typography>
            <Button
              variant="text"
              onClick={() => onNavigate('ledger')}
              sx={{ minWidth: 200 }}
            >
              Try as Guest
            </Button>
          </Box>
        </Stack>
      </Card>
    </Container>
  )
}

export default WelcomePage
