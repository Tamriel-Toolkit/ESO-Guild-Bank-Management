import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, TextField, Typography, Alert } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

const formatRoleLabel = (role) => {
  if (role === 'owner') {
    return 'Owner'
  }

  if (role === 'admin') {
    return 'Admin'
  }

  return 'Viewer'
}

function GuildAccessDialog({
  guildAccessGuild,
  closeGuildAccess,
  guildAccessError,
  guildAccessInviteSingleUse,
  setGuildAccessInviteSingleUse,
  guildAccessInviteExpiry,
  setGuildAccessInviteExpiry,
  inviteExpiryOptions,
  handleCreateGuildInvite,
  mutationPending,
  guildAccessInviteCode,
  handleUpdateGuildMemberRole,
  handleRemoveGuildMember,
}) {
  const canManagePermissions = Boolean(guildAccessGuild?.canManagePermissions)

  return (
    <Dialog open={Boolean(guildAccessGuild)} onClose={closeGuildAccess}>
      <DialogTitle>Guild Access</DialogTitle>
      <DialogContent>
        {guildAccessGuild && (
          <Stack spacing={2} sx={{ mt: 1, minWidth: 360 }}>
            <Typography variant="subtitle1">{guildAccessGuild.name}</Typography>
            {guildAccessError && <Alert severity="error">{guildAccessError}</Alert>}
            {canManagePermissions ? (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={guildAccessInviteSingleUse}
                      onChange={(event) => setGuildAccessInviteSingleUse(event.target.checked)}
                    />
                  }
                  label="Single use"
                />
                <FormControl fullWidth>
                  <InputLabel id="invite-expiry-label">Expire time</InputLabel>
                  <Select
                    labelId="invite-expiry-label"
                    label="Expire time"
                    value={guildAccessInviteExpiry}
                    onChange={(event) => setGuildAccessInviteExpiry(event.target.value)}
                  >
                    {inviteExpiryOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{
                  alignItems: { sm: 'center' }
                }}>
                  <Button variant="contained" onClick={handleCreateGuildInvite} disabled={mutationPending}>
                    Generate invite code
                  </Button>
                  <TextField
                    label="Code"
                    value={guildAccessInviteCode}
                    placeholder="Generate a code"
                    InputProps={{ readOnly: true }}
                    sx={{ flexGrow: 1 }}
                  />
                </Stack>
              </>
            ) : (
              <Alert severity="info" variant="outlined">
                Only the owner can create invites or change member permissions. You can still review the shared roster below.
              </Alert>
            )}
            <Stack spacing={1}>
              <Typography variant="subtitle2">Shared users</Typography>
              <List dense sx={{ border: 1, borderColor: 'divider', borderRadius: 1, py: 0 }}>
                {guildAccessGuild.members.map((member, index) => (
                  <Box key={member.userId}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem
                      secondaryAction={
                        !member.isOwner && canManagePermissions ? (
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            disabled={mutationPending}
                            onClick={() => handleRemoveGuildMember(guildAccessGuild, member)}
                          >
                            Remove
                          </Button>
                        ) : null
                      }
                    >
                      <ListItemText
                        primary={member.username}
                        secondary={member.isOwner ? 'Guild owner' : `Current role: ${formatRoleLabel(member.role)}`}
                      />
                      {member.isOwner ? (
                        <Chip size="small" label="Owner" />
                      ) : canManagePermissions ? (
                        <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
                          <InputLabel id={`guild-member-role-${member.userId}`}>Role</InputLabel>
                          <Select
                            labelId={`guild-member-role-${member.userId}`}
                            label="Role"
                            value={member.role}
                            disabled={mutationPending}
                            onChange={(event) => handleUpdateGuildMemberRole(guildAccessGuild, member, event.target.value)}
                          >
                            <MenuItem value="viewer">Viewer</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip size="small" label={formatRoleLabel(member.role)} variant="outlined" />
                      )}
                    </ListItem>
                  </Box>
                ))}
              </List>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={closeGuildAccess} disabled={mutationPending}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GuildAccessDialog