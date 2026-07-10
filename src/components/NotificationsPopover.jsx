import React from 'react'
import {
  Box,
  Divider,
  Popover,
  Stack,
  Typography,
  Alert,
} from '@mui/material'

const NotificationsPopover = ({ anchorEl, onClose, notifications }) => {
  const open = Boolean(anchorEl)
  const id = open ? 'notifications-popover' : undefined

  return (
    <Popover
      id={id}
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          width: 380,
          maxHeight: 500,
          mt: 1.5,
          border: '1px solid rgba(199, 161, 93, 0.25)',
          background: 'linear-gradient(180deg, rgba(34, 29, 23, 0.98), rgba(21, 18, 14, 0.98))',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#dfc690', fontWeight: 700 }}>
          Notifications
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(199, 161, 93, 0.12)' }} />
      <Box sx={{ p: 1.5, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            No new notifications
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {notifications.map((notification) => (
              <Alert
                key={notification.id}
                severity={notification.severity}
                action={notification.action}
                onClose={notification.onClose}
                sx={{
                  backgroundColor: 'rgba(199, 161, 93, 0.05)',
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
              >
                {notification.message}
              </Alert>
            ))}
          </Stack>
        )}
      </Box>
    </Popover>
  )
}

export default NotificationsPopover
