import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

function titleCase(value) {
  return String(value || '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatAction(action) {
  return titleCase(String(action || '').replace(/\./g, ' '))
}

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown time'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function formatTarget(auditLog) {
  const { details = {}, entityType, entityId } = auditLog

  if (details.name) {
    return details.name
  }

  if (details.username) {
    return details.username
  }

  if (details.email) {
    return details.email
  }

  if (entityType === 'entry') {
    const entryType = details.type ? titleCase(details.type) : 'Entry'
    const amount = Number.isFinite(details.amount)
      ? ` • ${Number(details.amount).toLocaleString()} gold`
      : ''
    return `${entryType}${amount}`
  }

  if (entityType === 'guild') {
    return entityId ? `Guild ${entityId}` : 'Guild activity'
  }

  return entityId ? `${titleCase(entityType)} ${entityId}` : titleCase(entityType || 'Activity')
}

function AuditLogDialog({ open, onClose, guildName, auditLogs, auditLogLoading, auditLogError }) {
  return (
    <Dialog open={open} onClose={auditLogLoading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{guildName ? `${guildName} Audit History` : 'Audit History'}</DialogTitle>
      <DialogContent>
        {auditLogError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {auditLogError}
          </Alert>
        )}
        {auditLogLoading ? (
          <Typography sx={{ mt: 2 }}>Loading audit history...</Typography>
        ) : auditLogs.length === 0 ? (
          <Typography sx={{ mt: 2 }} color="text.secondary">
            No audit history is available for this guild yet.
          </Typography>
        ) : (
          <TableContainer sx={{ mt: 1 }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((auditLog) => (
                  <TableRow key={auditLog.id}>
                    <TableCell>{auditLog.actorUsername}</TableCell>
                    <TableCell>{formatAction(auditLog.action)}</TableCell>
                    <TableCell>{formatTarget(auditLog)}</TableCell>
                    <TableCell>{formatTimestamp(auditLog.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={auditLogLoading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AuditLogDialog