import { Alert, Box, Button, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'

const formatRoleLabel = (role) => {
  if (role === 'owner') {
    return 'Owner'
  }

  if (role === 'admin') {
    return 'Admin'
  }

  return 'Viewer'
}

function GuildProfilesDrawer({
  currentUser,
  drawerContentRef,
  guildDrawerWidth,
  newGuildName,
  setNewGuildName,
  settingsInviteError,
  settingsInviteCode,
  setSettingsInviteCode,
  handleCreateGuild,
  handleRedeemInviteCode,
  mutationPending,
  handleOpenAuditLog,
  handleOpenGuildAccess,
  handleRenameGuild,
  handleDeleteGuild,
  handleLeaveGuild,
  handleSelectGuild,
  isMobileLayout,
  guildDrawerOpen,
  setGuildDrawerOpen,
}) {
  if (!currentUser) {
    return null
  }

  return (
    <Drawer
      anchor="right"
      variant={isMobileLayout ? 'temporary' : 'permanent'}
      open={isMobileLayout ? guildDrawerOpen : true}
      onClose={() => setGuildDrawerOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: isMobileLayout ? 'min(85vw, 360px)' : guildDrawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isMobileLayout ? 'min(85vw, 360px)' : guildDrawerWidth,
          boxSizing: 'border-box',
          p: 2,
          top: { xs: 56, sm: 64 },
          height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
        },
      }}
    >
      <Box ref={drawerContentRef}>
        <Typography variant="h6" sx={{ mt: 1 }}>
          Guild Profiles
        </Typography>
        <Stack direction="row" spacing={1} sx={{ my: 2 }}>
        <TextField
          size="small"
          label="New guild"
          value={newGuildName}
          onChange={(event) => setNewGuildName(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 32 } }}
          fullWidth
        />
        <Button
          variant="contained"
          onClick={() => {
            handleCreateGuild()
            if (isMobileLayout) {
              setGuildDrawerOpen(false)
            }
          }}
          disabled={mutationPending}
        >
          Add
        </Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mb: 4 }}>
          <Typography variant="subtitle2">Join Shared Guild</Typography>
          {settingsInviteError && <Alert severity="error">{settingsInviteError}</Alert>}
          <TextField
            size="small"
            label="Invite code"
            value={settingsInviteCode}
            onChange={(event) => setSettingsInviteCode(event.target.value.toUpperCase())}
            placeholder="ABCD-EF12-3456"
            fullWidth
          />
          <Button variant="outlined" onClick={handleRedeemInviteCode} disabled={mutationPending}>
            Join guild
          </Button>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        <List dense>
          {currentUser.guilds?.map((guild) => (
            <ListItem
              key={guild.id}
              disablePadding
              secondaryAction={
                <Stack direction="row" spacing={0.5} sx={{ display: 'flex', overflow: 'auto' }}>
                  <IconButton
                    edge="end"
                    onClick={() => {
                      handleOpenAuditLog(guild)
                      if (isMobileLayout) {
                        setGuildDrawerOpen(false)
                      }
                    }}
                  >
                    <HistoryEduOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => {
                      handleOpenGuildAccess(guild.id)
                      if (isMobileLayout) {
                        setGuildDrawerOpen(false)
                      }
                    }}
                  >
                    <GroupAddIcon fontSize="small" />
                  </IconButton>
                  {guild.canEdit && (
                    <>
                      <IconButton
                        edge="end"
                        onClick={() => {
                          handleRenameGuild(guild.id, guild.name)
                          if (isMobileLayout) {
                            setGuildDrawerOpen(false)
                          }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {guild.canDelete && (
                    <>
                      <IconButton
                        edge="end"
                        onClick={() => {
                          handleDeleteGuild(guild.id)
                          if (isMobileLayout) {
                            setGuildDrawerOpen(false)
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {!guild.isOwner && (
                    <IconButton
                      edge="end"
                      onClick={() => {
                        handleLeaveGuild(guild)
                        if (isMobileLayout) {
                          setGuildDrawerOpen(false)
                        }
                      }}
                      disabled={mutationPending}
                    >
                      <ExitToAppIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              }
            >
              <ListItemButton
                selected={guild.id === currentUser.selectedGuildId}
                sx={{ pr: guild.canDelete ? 22 : guild.canEdit || guild.canManagePermissions ? 18 : 8 }}
                onClick={() => {
                  handleSelectGuild(guild.id)
                  if (isMobileLayout) {
                    setGuildDrawerOpen(false)
                  }
                }}
              >
                <ListItemText
                  primary={guild.name}
                  secondary={`${guild.entries.length} entries • ${formatRoleLabel(guild.role)}${guild.isOwner ? '' : ` • Shared by ${guild.ownerUsername}`}`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  )
}

export default GuildProfilesDrawer