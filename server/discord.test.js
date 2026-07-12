import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const serverPort = 3105
const serverOrigin = `http://127.0.0.1:${serverPort}`
const requestHeaders = {
  Origin: 'http://localhost:5173',
  'X-Requested-With': 'XMLHttpRequest',
  'x-csrf-token': 'test-token',
}

let tempDirectory
let databaseFile
let serverProcess

class SessionClient {
  constructor() {
    this.cookieHeader = 'csrf_token=test-token'
  }

  async request(targetPath, { method = 'GET', body, headers: customHeaders = {} } = {}) {
    const headers = { ...requestHeaders }
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
      const cookies = setCookie.split(',').map(c => c.split(';', 1)[0])
      this.cookieHeader = cookies.join('; ')
    }

    if (response.status === 204) return { response, payload: null }

    const text = await response.text()
    let payload = null
    try {
        payload = JSON.parse(text)
    } catch (e) {
        if (text) console.error('PARSE ERROR', text)
    }
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

    childProcess.on('exit', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timeoutId)
        reject(new Error(`Test server exited early with code ${code}.`))
      }
    })
  })
}

describe('Discord Bot Settings Integration', () => {
  before(async () => {
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'eso-guild-discord-tests-'))
    databaseFile = path.join(tempDirectory, 'guild-bank-test.db')
    const mailCaptureDirectory = path.join(tempDirectory, 'mail-capture')
    await fs.mkdir(mailCaptureDirectory)

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
        DISCORD_BOT_TOKEN: '',
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

  it('supports getting and updating discord bot settings', async () => {
    const owner = new SessionClient()

    // Sign up
    const signup = await owner.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'discord_owner', email: 'discord@example.com', password: 'password1234' },
    })
    assert.equal(signup.response.status, 201, signup.payload?.error)

    // Create guild
    const guildCreate = await owner.request('/api/guilds', {
      method: 'POST',
      body: { name: 'Discord Guild' },
    })
    assert.equal(guildCreate.response.status, 201, guildCreate.payload?.error)

    // We need to fetch the session to get the guild info
    const session = await owner.request('/api/session')
    const guildId = session.payload.user.guilds[0].id

    // Get default discord settings
    const getSettings = await owner.request(`/api/guilds/${guildId}/discord`)
    assert.equal(getSettings.response.status, 200)
    assert.equal(getSettings.payload.settings.botEnabled, false)
    assert.equal(getSettings.payload.settings.channelId, '')

    // Update settings
    const updateSettings = await owner.request(`/api/guilds/${guildId}/discord`, {
      method: 'PATCH',
      body: {
        channelId: '123456789',
        botEnabled: true,
        eventTypes: ['audit_log', 'daily_summary']
      }
    })
    assert.equal(updateSettings.response.status, 200)

    // Verify updated settings
    const getUpdatedSettings = await owner.request(`/api/guilds/${guildId}/discord`)
    assert.equal(getUpdatedSettings.payload.settings.botEnabled, true)
    assert.equal(getUpdatedSettings.payload.settings.channelId, '123456789')
    assert.deepEqual(getUpdatedSettings.payload.settings.eventTypes, ['audit_log', 'daily_summary'])
  })
})
