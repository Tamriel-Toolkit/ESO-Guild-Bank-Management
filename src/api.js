function getFallbackErrorMessage(path, status) {
  if (path === '/api/auth/signup' && status === 409) {
    return 'That username is already in use. Choose a different username or log in instead.'
  }

  if (path === '/api/auth/signup' && status === 429) {
    return 'Too many account creation attempts were made. Please wait a few minutes and try again.'
  }

  if (path === '/api/auth/login' && status === 401) {
    return 'The username or password you entered is incorrect.'
  }

  if (path === '/api/auth/login' && status === 429) {
    return 'Too many sign-in attempts were made. Please wait a few minutes and try again.'
  }

  if (status === 401) {
    return 'Your session has expired or you are not signed in. Please log in and try again.'
  }

  if (status === 403) {
    return 'This request was blocked for security reasons. Refresh the page and try again.'
  }

  if (status === 404) {
    return 'The item you were trying to use could not be found. Refresh the page and try again.'
  }

  if (status === 429) {
    return 'Too many requests were sent in a short time. Please wait a moment and try again.'
  }

  if (status >= 500) {
    return 'The server ran into a problem. Please try again in a moment.'
  }

  return 'Something went wrong while talking to the server. Please try again.'
}

async function parseResponsePayload(response) {
  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await parseResponsePayload(response)
  if (!response.ok) {
    throw new Error(payload?.error || getFallbackErrorMessage(path, response.status))
  }

  return payload
}

export const getSession = () => apiRequest('/api/session')

export const signUp = (credentials) =>
  apiRequest('/api/auth/signup', {
    method: 'POST',
    body: credentials,
  })

export const logIn = (credentials) =>
  apiRequest('/api/auth/login', {
    method: 'POST',
    body: credentials,
  })

export const verifyEmailToken = (token) =>
  apiRequest('/api/auth/email-verification/verify', {
    method: 'POST',
    body: { token },
  })

export const resendVerificationEmail = () =>
  apiRequest('/api/auth/email-verification/resend', {
    method: 'POST',
  })

export const requestPasswordReset = (email) =>
  apiRequest('/api/auth/password-reset/request', {
    method: 'POST',
    body: { email },
  })

export const confirmPasswordReset = (token, password) =>
  apiRequest('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: { token, password },
  })

export const logOut = () =>
  apiRequest('/api/auth/logout', {
    method: 'POST',
  })

export const deleteAccount = (payload) =>
  apiRequest('/api/account', {
    method: 'DELETE',
    body: payload,
  })

export const updateRecoveryEmail = (payload) =>
  apiRequest('/api/account/email', {
    method: 'PATCH',
    body: payload,
  })

export const createGuild = (payload) =>
  apiRequest('/api/guilds', {
    method: 'POST',
    body: payload,
  })

export const importGuestGuild = (payload) =>
  apiRequest('/api/guilds/import-guest', {
    method: 'POST',
    body: payload,
  })

export const renameGuild = (guildId, name) =>
  apiRequest(`/api/guilds/${guildId}`, {
    method: 'PATCH',
    body: { name },
  })

export const updateGuildWeekStartDate = (guildId, weekStartDate) =>
  apiRequest(`/api/guilds/${guildId}`, {
    method: 'PATCH',
    body: { weekStartDate },
  })

export const selectGuild = (guildId) =>
  apiRequest(`/api/guilds/${guildId}/select`, {
    method: 'POST',
  })

export const deleteGuild = (guildId) =>
  apiRequest(`/api/guilds/${guildId}`, {
    method: 'DELETE',
  })

export const leaveGuild = (guildId) =>
  apiRequest(`/api/guilds/${guildId}/membership`, {
    method: 'DELETE',
  })

export const createGuildInvite = (guildId, payload) =>
  apiRequest(`/api/guilds/${guildId}/invites`, {
    method: 'POST',
    body: payload,
  })

export const getGuildAuditLogs = (guildId) => apiRequest(`/api/guilds/${guildId}/audit-logs`)

export const redeemGuildInvite = (code) =>
  apiRequest('/api/invites/redeem', {
    method: 'POST',
    body: { code },
  })

export const removeGuildMember = (guildId, memberUserId) =>
  apiRequest(`/api/guilds/${guildId}/members/${memberUserId}`, {
    method: 'DELETE',
  })

export const createEntryForGuild = (guildId, payload) =>
  apiRequest(`/api/guilds/${guildId}/entries`, {
    method: 'POST',
    body: payload,
  })

export const updateEntryInGuild = (guildId, entryId, payload) =>
  apiRequest(`/api/guilds/${guildId}/entries/${entryId}`, {
    method: 'PATCH',
    body: payload,
  })

export const deleteEntryFromGuild = (guildId, entryId) =>
  apiRequest(`/api/guilds/${guildId}/entries/${entryId}`, {
    method: 'DELETE',
  })