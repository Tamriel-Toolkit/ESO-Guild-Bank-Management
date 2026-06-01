import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

function PasswordResetConfirmDialog({
  open,
  onClose,
  passwordResetDraft,
  setPasswordResetDraft,
  passwordResetError,
  mutationPending,
  handleConfirmPasswordReset,
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Choose a new password</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
          {passwordResetError && <Alert severity="error">{passwordResetError}</Alert>}
          <TextField
            label="New password"
            type="password"
            value={passwordResetDraft.password}
            onChange={(event) =>
              setPasswordResetDraft((prev) => ({ ...prev, password: event.target.value }))
            }
            helperText="Use at least 10 characters."
            fullWidth
          />
          <TextField
            label="Confirm new password"
            type="password"
            value={passwordResetDraft.confirmPassword}
            onChange={(event) =>
              setPasswordResetDraft((prev) => ({ ...prev, confirmPassword: event.target.value }))
            }
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={mutationPending}>
          Close
        </Button>
        <Button variant="contained" onClick={handleConfirmPasswordReset} disabled={mutationPending}>
          Update password
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PasswordResetConfirmDialog