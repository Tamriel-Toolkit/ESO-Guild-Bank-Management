import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const serverPort = 3101
const serverOrigin = `http://127.0.0.1:${serverPort}`
const requestHeaders = {
  Origin: 'http://localhost:5173',
  'X-Requested-With': 'XMLHttpRequest',
}

let tempDirectory
let databaseFile
let mailCaptureDirectory
let serverProcess

class SessionClient {
  constructor() {
    this.cookieHeader = ''
  }

  async request(targetPath, { method = 'GET', body, headers: customHeaders = {}, omitHeaders = [] } = {}) {
    const headers = { ...requestHeaders }
    for (const headerName of omitHeaders) {
      delete headers[headerName]
    }
    Object.assign(headers, customHeaders)

    if (this.cookieHeader) {
      headers.Cookie = this.cookieHeader
    }
    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${serverOrigin}${targetPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      this.cookieHeader = setCookie.split(';', 1)[0]
    }

    const payload = response.status === 204 ? null : await response.json()
    return { response, payload }
  }
}

function waitForServerReady(childProcess) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('Timed out waiting for test server to start.'))
      }
    }, 10000)

    childProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      if (!settled && text.includes('ESO Guild Bank API listening')) {
        settled = true
        clearTimeout(timeoutId)
        resolve()
      }
    })

    childProcess.stderr.on('data', (chunk) => {
      if (!settled) {
        settled = true
        clearTimeout(timeoutId)
        reject(new Error(chunk.toString()))
      }
    })

    childProcess.on('exit', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timeoutId)
        reject(new Error(`Test server exited early with code ${code}.`))
      }
    })
  })
}

async function waitForCondition(check, { timeoutMs = 10000, intervalMs = 100 } = {}) {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await check()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('Timed out waiting for condition.')
}

async function waitForCapturedMail(category, recipient) {
  let capturedMail = null

  await waitForCondition(async () => {
    const files = await fs.readdir(mailCaptureDirectory).catch(() => [])
    for (const fileName of files.sort()) {
      const content = await fs.readFile(path.join(mailCaptureDirectory, fileName), 'utf8')
      const parsed = JSON.parse(content)
      if (parsed.category === category && (!recipient || parsed.to === recipient)) {
        capturedMail = parsed
        return true
      }
    }

    return false
  })

  return capturedMail
}

function extractTokenFromMail(capturedMail, queryParam) {
  const mailUrl = capturedMail.text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('http://') || line.startsWith('https://'))

  assert.ok(mailUrl)
  const parsedUrl = new URL(mailUrl)
  const token = parsedUrl.searchParams.get(queryParam)
  assert.ok(token)
  return token
}

describe('auth and guild sharing flows', () => {
  before(async () => {
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'eso-guild-bank-tests-'))
    databaseFile = path.join(tempDirectory, 'guild-bank-test.db')
    mailCaptureDirectory = path.join(tempDirectory, 'mail-capture')

    serverProcess = spawn('node', ['server/index.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(serverPort),
        DATABASE_FILE: databaseFile,
        API_RATE_LIMIT: '1000',
        AUTH_RATE_LIMIT: '1000',
        MAIL_CAPTURE_DIRECTORY: mailCaptureDirectory,
        BACKUP_MIN_INTERVAL_MS: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    await waitForServerReady(serverProcess)
  })

  after(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill()
      await new Promise((resolve) => serverProcess.once('exit', resolve))
    }

    if (tempDirectory) {
      await fs.rm(tempDirectory, { recursive: true, force: true })
    }
  })

  it('supports signup and login', async () => {
    const user = new SessionClient()

    const signUpResult = await user.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'owner_user', email: 'owner_user@example.com', password: 'password1234' },
    })

    assert.equal(signUpResult.response.status, 201)
    assert.equal(signUpResult.payload.user.username, 'owner_user')
    assert.equal(signUpResult.payload.user.email, 'owner_user@example.com')
    assert.equal(signUpResult.payload.user.emailVerified, false)
    assert.equal(
      signUpResult.payload.notice,
      'Account created. Check your email to verify your recovery address.',
    )
  const signUpCookie = signUpResult.response.headers.get('set-cookie')
  assert.ok(signUpCookie)
  assert.equal(signUpCookie.includes('HttpOnly'), true)
  assert.equal(signUpCookie.includes('SameSite=Lax'), true)
  assert.equal(signUpCookie.includes('Path=/'), true)

    const sessionResult = await user.request('/api/session')
    assert.equal(sessionResult.response.status, 200)
    assert.equal(sessionResult.payload.user.username, 'owner_user')

    const logoutResult = await user.request('/api/auth/logout', { method: 'POST' })
    assert.equal(logoutResult.response.status, 204)

    const loginResult = await user.request('/api/auth/login', {
      method: 'POST',
      body: { username: 'owner_user', password: 'password1234' },
    })

    assert.equal(loginResult.response.status, 200)
    assert.equal(loginResult.payload.user.username, 'owner_user')
  })

  it('exposes health details and baseline security headers', async () => {
    const response = await fetch(`${serverOrigin}/healthz`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.service, 'eso-guild-gold-ledger')
    assert.equal(payload.publicAppUrl, 'https://www.esoguildgoldledger.com')
    assert.ok(Number.isNaN(Date.parse(payload.timestamp)) === false)

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN')
    assert.equal(response.headers.get('content-security-policy')?.includes("default-src 'self'"), true)
  })

  it('rejects mutating API requests without the CSRF header', async () => {
    const response = await fetch(`${serverOrigin}/api/auth/signup`, {
      method: 'POST',
      headers: {
        Origin: requestHeaders.Origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'csrf_user', password: 'password1234' }),
    })
    const payload = await response.json()

    assert.equal(response.status, 403)
    assert.equal(
      payload.error,
      'This request is missing a required security header. Refresh the page and try again.',
    )
  })

  it('returns a JSON error when a username is already in use', async () => {
    const firstUser = new SessionClient()
    const secondUser = new SessionClient()

    const firstSignUp = await firstUser.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'taken_name', email: 'taken_name_a@example.com', password: 'password1234' },
    })
    assert.equal(firstSignUp.response.status, 201)

    const duplicateSignUp = await secondUser.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'taken_name', email: 'taken_name_b@example.com', password: 'password1234' },
    })

    assert.equal(duplicateSignUp.response.status, 409)
    assert.equal(duplicateSignUp.response.headers.get('content-type'), 'application/json; charset=utf-8')
    assert.equal(
      duplicateSignUp.payload.error,
      'That username is already in use. Choose a different username or log in instead.',
    )
  })

  it('supports guild invite, join, leave, and owner removal flows', async () => {
    const owner = new SessionClient()
    const member = new SessionClient()
    const removedMember = new SessionClient()

    const ownerSignUp = await owner.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'guild_owner', email: 'guild_owner@example.com', password: 'password1234' },
    })
    assert.equal(ownerSignUp.response.status, 201)

    const guildCreate = await owner.request('/api/guilds', {
      method: 'POST',
      body: { name: 'Shared Guild', weekStartDate: '2026-05-31' },
    })
    assert.equal(guildCreate.response.status, 201)
    const guildId = guildCreate.payload.user.selectedGuildId

    const memberSignUp = await member.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'shared_member', email: 'shared_member@example.com', password: 'password1234' },
    })
    assert.equal(memberSignUp.response.status, 201)

    const inviteCreate = await owner.request(`/api/guilds/${guildId}/invites`, {
      method: 'POST',
      body: { singleUse: false, expiresInHours: 24 },
    })
    assert.equal(inviteCreate.response.status, 201)
    assert.ok(inviteCreate.payload.code)

    const inviteRedeem = await member.request('/api/invites/redeem', {
      method: 'POST',
      body: { code: inviteCreate.payload.code },
    })
    assert.equal(inviteRedeem.response.status, 200)
    assert.equal(inviteRedeem.payload.user.selectedGuildId, guildId)
    assert.equal(
      inviteRedeem.payload.user.guilds.some((guild) => guild.id === guildId),
      true,
    )

    const ownerSessionAfterJoin = await owner.request('/api/session')
    const ownerGuildAfterJoin = ownerSessionAfterJoin.payload.user.guilds.find((guild) => guild.id === guildId)
    assert.equal(ownerGuildAfterJoin.members.some((guildMember) => guildMember.username === 'shared_member'), true)

    const ownerAuditLogs = await owner.request(`/api/guilds/${guildId}/audit-logs`)
    assert.equal(ownerAuditLogs.response.status, 200)
    assert.equal(Array.isArray(ownerAuditLogs.payload.auditLogs), true)
    assert.equal(ownerAuditLogs.payload.auditLogs.some((row) => row.action === 'guild.create'), true)
    assert.equal(ownerAuditLogs.payload.auditLogs.some((row) => row.action === 'guild.invite_create'), true)
    assert.equal(ownerAuditLogs.payload.auditLogs.some((row) => row.action === 'guild.invite_redeem'), true)
    const createAuditRow = ownerAuditLogs.payload.auditLogs.find((row) => row.action === 'guild.create')
    assert.equal(createAuditRow.actorUsername, 'guild_owner')
    assert.equal(typeof createAuditRow.createdAt, 'string')

    const memberAuditLogs = await member.request(`/api/guilds/${guildId}/audit-logs`)
    assert.equal(memberAuditLogs.response.status, 403)
    assert.equal(memberAuditLogs.payload.error, 'Only guild owners can view this audit history.')

    const leaveResult = await member.request(`/api/guilds/${guildId}/membership`, {
      method: 'DELETE',
    })
    assert.equal(leaveResult.response.status, 200)
    assert.equal(leaveResult.payload.user.guilds.some((guild) => guild.id === guildId), false)

    const ownerSessionAfterLeave = await owner.request('/api/session')
    const ownerGuildAfterLeave = ownerSessionAfterLeave.payload.user.guilds.find((guild) => guild.id === guildId)
    assert.equal(ownerGuildAfterLeave.members.some((guildMember) => guildMember.username === 'shared_member'), false)

    const removedMemberSignUp = await removedMember.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'removed_member', email: 'removed_member@example.com', password: 'password1234' },
    })
    assert.equal(removedMemberSignUp.response.status, 201)

    const secondRedeem = await removedMember.request('/api/invites/redeem', {
      method: 'POST',
      body: { code: inviteCreate.payload.code },
    })
    assert.equal(secondRedeem.response.status, 200)
    assert.equal(secondRedeem.payload.user.guilds.some((guild) => guild.id === guildId), true)

    const ownerSessionBeforeRemoval = await owner.request('/api/session')
    const ownerGuildBeforeRemoval = ownerSessionBeforeRemoval.payload.user.guilds.find((guild) => guild.id === guildId)
    const removableMember = ownerGuildBeforeRemoval.members.find((guildMember) => guildMember.username === 'removed_member')
    assert.ok(removableMember)

    const removeResult = await owner.request(`/api/guilds/${guildId}/members/${removableMember.userId}`, {
      method: 'DELETE',
    })
    assert.equal(removeResult.response.status, 200)
    const ownerGuildAfterRemoval = removeResult.payload.user.guilds.find((guild) => guild.id === guildId)
    assert.equal(ownerGuildAfterRemoval.members.some((guildMember) => guildMember.username === 'removed_member'), false)

    const removedMemberSession = await removedMember.request('/api/session')
    assert.equal(removedMemberSession.payload.user.guilds.some((guild) => guild.id === guildId), false)

    const backupDirectory = path.join(path.dirname(databaseFile), 'backups')
    await waitForCondition(async () => {
      const backupFiles = await fs.readdir(backupDirectory).catch(() => [])
      return backupFiles.some((fileName) => fileName.endsWith('.db'))
    })

    const testDb = new Database(databaseFile, { readonly: true })
    const auditActions = testDb.prepare('SELECT action FROM audit_logs ORDER BY id ASC').all()
    testDb.close()

    const actionNames = auditActions.map((row) => row.action)
    assert.equal(actionNames.includes('guild.create'), true)
    assert.equal(actionNames.includes('guild.invite_create'), true)
    assert.equal(actionNames.includes('guild.invite_redeem'), true)
    assert.equal(actionNames.includes('guild.leave'), true)
    assert.equal(actionNames.includes('guild.member_remove'), true)
  })

  it('supports email verification and password reset', async () => {
    const user = new SessionClient()

    const signUpResult = await user.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'recover_me', email: 'recover_me@example.com', password: 'password1234' },
    })
    assert.equal(signUpResult.response.status, 201)
    assert.equal(signUpResult.payload.user.emailVerified, false)

    const verificationMail = await waitForCapturedMail('verify-email', 'recover_me@example.com')
    const verificationToken = extractTokenFromMail(verificationMail, 'verify-email')

    const verifyResult = await user.request('/api/auth/email-verification/verify', {
      method: 'POST',
      body: { token: verificationToken },
    })
    assert.equal(verifyResult.response.status, 200)
    assert.equal(
      verifyResult.payload.message,
      'Recovery email verified. You can now reset your password if needed.',
    )

    const verifiedSession = await user.request('/api/session')
    assert.equal(verifiedSession.response.status, 200)
    assert.equal(verifiedSession.payload.user.emailVerified, true)

    const requestReset = await user.request('/api/auth/password-reset/request', {
      method: 'POST',
      body: { email: 'recover_me@example.com' },
    })
    assert.equal(requestReset.response.status, 200)
    assert.equal(
      requestReset.payload.message,
      'If that recovery email is attached to an account, a password reset link has been sent.',
    )

    const resetMail = await waitForCapturedMail('password-reset', 'recover_me@example.com')
    const resetToken = extractTokenFromMail(resetMail, 'reset-password')

    const confirmReset = await user.request('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: { token: resetToken, password: 'brandnewpass123' },
    })
    assert.equal(confirmReset.response.status, 200)
    assert.equal(confirmReset.payload.message, 'Password updated. Log in with your new password.')

    const sessionAfterReset = await user.request('/api/session')
    assert.equal(sessionAfterReset.response.status, 200)
    assert.equal(sessionAfterReset.payload.user, null)

    const oldPasswordLogin = await user.request('/api/auth/login', {
      method: 'POST',
      body: { username: 'recover_me', password: 'password1234' },
    })
    assert.equal(oldPasswordLogin.response.status, 401)

    const newPasswordLogin = await user.request('/api/auth/login', {
      method: 'POST',
      body: { username: 'recover_me', password: 'brandnewpass123' },
    })
    assert.equal(newPasswordLogin.response.status, 200)
    assert.equal(newPasswordLogin.payload.user.username, 'recover_me')
  })

  it('enforces single-use invites and validates invite expiry input', async () => {
    const owner = new SessionClient()
    const firstMember = new SessionClient()
    const secondMember = new SessionClient()

    const ownerSignUp = await owner.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'single_use_owner', email: 'single_use_owner@example.com', password: 'password1234' },
    })
    assert.equal(ownerSignUp.response.status, 201)

    const guildCreate = await owner.request('/api/guilds', {
      method: 'POST',
      body: { name: 'Invite Rules Guild', weekStartDate: '2026-05-31' },
    })
    assert.equal(guildCreate.response.status, 201)
    const guildId = guildCreate.payload.user.selectedGuildId

    const invalidInvite = await owner.request(`/api/guilds/${guildId}/invites`, {
      method: 'POST',
      body: { singleUse: true, expiresInHours: 0 },
    })
    assert.equal(invalidInvite.response.status, 400)
    assert.equal(invalidInvite.payload.error, 'Choose a valid invite expiration time.')

    const createInvite = await owner.request(`/api/guilds/${guildId}/invites`, {
      method: 'POST',
      body: { singleUse: true, expiresInHours: 24 },
    })
    assert.equal(createInvite.response.status, 201)
    assert.equal(createInvite.payload.singleUse, true)

    const firstMemberSignUp = await firstMember.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'single_use_member_a', email: 'single_use_member_a@example.com', password: 'password1234' },
    })
    assert.equal(firstMemberSignUp.response.status, 201)

    const secondMemberSignUp = await secondMember.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'single_use_member_b', email: 'single_use_member_b@example.com', password: 'password1234' },
    })
    assert.equal(secondMemberSignUp.response.status, 201)

    const firstRedeem = await firstMember.request('/api/invites/redeem', {
      method: 'POST',
      body: { code: createInvite.payload.code },
    })
    assert.equal(firstRedeem.response.status, 200)
    assert.equal(firstRedeem.payload.user.guilds.some((guild) => guild.id === guildId), true)

    const secondRedeem = await secondMember.request('/api/invites/redeem', {
      method: 'POST',
      body: { code: createInvite.payload.code },
    })
    assert.equal(secondRedeem.response.status, 404)
    assert.equal(
      secondRedeem.payload.error,
      'That invite code is not valid anymore. It may be incorrect, expired, or already used.',
    )
  })
})
