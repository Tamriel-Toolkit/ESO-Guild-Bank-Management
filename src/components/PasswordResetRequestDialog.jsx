import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

function PasswordResetRequestDialog({
  open,
  onClose,
  passwordResetRequestEmail,
  setPasswordResetRequestEmail,
  passwordResetRequestError,
  passwordResetRequestNotice,
  mutationPending,
  handleRequestPasswordReset,
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Reset password</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
          {passwordResetRequestError && <Alert severity="error">{passwordResetRequestError}</Alert>}
          {passwordResetRequestNotice && <Alert severity="success">{passwordResetRequestNotice}</Alert>}
          <TextField
            label="Recovery email"
            type="email"
            value={passwordResetRequestEmail}
            onChange={(event) => setPasswordResetRequestEmail(event.target.value)}
            helperText="If that email is on an account, a reset link will be sent."
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={mutationPending}>
          Close
        </Button>
        <Button variant="contained" onClick={handleRequestPasswordReset} disabled={mutationPending}>
          Send reset link
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PasswordResetRequestDialog