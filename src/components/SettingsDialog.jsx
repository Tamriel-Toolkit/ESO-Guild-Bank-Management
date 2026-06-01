import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from '@mui/material'

function SettingsDialog({
  currentUser,
  settingsOpen,
  closeSettings,
  mutationPending,
  settingsInviteError,
  settingsInviteCode,
  setSettingsInviteCode,
  handleRedeemInviteCode,
  recoveryEmailDraft,
  setRecoveryEmailDraft,
  recoveryEmailError,
  recoveryEmailNotice,
  handleUpdateRecoveryEmail,
  handleResendVerificationEmail,
  handleOpenDeleteAccountFromSettings,
}) {
  return (
    <Dialog open={settingsOpen} onClose={closeSettings}>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1, minWidth: 340 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Account Recovery</Typography>
            {recoveryEmailError && <Alert severity="error">{recoveryEmailError}</Alert>}
            {recoveryEmailNotice && <Alert severity="success">{recoveryEmailNotice}</Alert>}
            {currentUser?.email ? (
              <Alert severity={currentUser.emailVerified ? 'success' : 'warning'}>
                {currentUser.emailVerified
                  ? `Verified recovery email: ${currentUser.email}`
                  : `Recovery email ${currentUser.email} is waiting for verification.`}
              </Alert>
            ) : (
              <Alert severity="warning">Add a verified recovery email so password resets are possible.</Alert>
            )}
            <TextField
              label="Recovery email"
              type="email"
              value={recoveryEmailDraft.email}
              onChange={(event) =>
                setRecoveryEmailDraft((prev) => ({ ...prev, email: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Current password"
              type="password"
              value={recoveryEmailDraft.password}
              onChange={(event) =>
                setRecoveryEmailDraft((prev) => ({ ...prev, password: event.target.value }))
              }
              helperText="Required to change your recovery email."
              fullWidth
            />
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button variant="contained" onClick={handleUpdateRecoveryEmail} disabled={mutationPending}>
                Save recovery email
              </Button>
              {currentUser?.email && !currentUser.emailVerified && (
                <Button variant="outlined" onClick={handleResendVerificationEmail} disabled={mutationPending}>
                  Resend verification
                </Button>
              )}
            </Stack>
          </Stack>
          <Divider />
          <Stack spacing={2}>
            <Typography variant="subtitle1">Join Shared Guild</Typography>
            {settingsInviteError && <Alert severity="error">{settingsInviteError}</Alert>}
            <TextField
              label="Invite code"
              value={settingsInviteCode}
              onChange={(event) => setSettingsInviteCode(event.target.value.toUpperCase())}
              placeholder="ABCD-EF12-3456"
              fullWidth
            />
            <Button variant="contained" onClick={handleRedeemInviteCode} disabled={mutationPending}>
              Join guild
            </Button>
          </Stack>
          <Divider />
          <Stack spacing={1.5}>
            <Typography variant="subtitle1">Account</Typography>
            <Button
              color="error"
              variant="outlined"
              onClick={handleOpenDeleteAccountFromSettings}
              disabled={mutationPending}
            >
              Delete account
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={closeSettings} disabled={mutationPending}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SettingsDialog