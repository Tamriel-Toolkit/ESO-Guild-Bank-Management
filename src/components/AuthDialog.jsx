import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

function AuthDialog({
  authOpen,
  setAuthOpen,
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  authDraft,
  setAuthDraft,
  authSubmitting,
  handleAuth,
  openPasswordResetRequest,
}) {
  return (
    <Dialog open={authOpen} onClose={() => setAuthOpen(false)}>
      <DialogTitle>{authMode === 'login' ? 'Log in' : 'Create account'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
          {authError && <Alert severity="error">{authError}</Alert>}
          <TextField
            label="Username"
            value={authDraft.username}
            onChange={(event) =>
              setAuthDraft((prev) => ({ ...prev, username: event.target.value }))
            }
            fullWidth
          />
          {authMode === 'signup' && (
            <TextField
              label="Recovery email"
              type="email"
              value={authDraft.email}
              onChange={(event) =>
                setAuthDraft((prev) => ({ ...prev, email: event.target.value }))
              }
              helperText="Used for verification and password resets."
              fullWidth
            />
          )}
          <TextField
            label="Password"
            type="password"
            value={authDraft.password}
            onChange={(event) =>
              setAuthDraft((prev) => ({ ...prev, password: event.target.value }))
            }
            helperText="Use at least 10 characters."
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{
          flexWrap: "wrap"
        }}>
          <Button
            onClick={() => {
              setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
              setAuthError('')
            }}
          >
            {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
          </Button>
          {authMode === 'login' && (
            <Button onClick={openPasswordResetRequest}>Forgot password?</Button>
          )}
        </Stack>
        <Button variant="contained" onClick={handleAuth} disabled={authSubmitting}>
          {authMode === 'login' ? 'Log in' : 'Create account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AuthDialog