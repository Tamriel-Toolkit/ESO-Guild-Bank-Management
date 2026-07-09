import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const serverPort = 3102
const serverOrigin = `http://127.0.0.1:${serverPort}`
const requestHeaders = {
  Origin: 'http://localhost:5173',
  'X-Requested-With': 'XMLHttpRequest',
  'x-csrf-token': 'test-token',
}

let tempDirectory
let databaseFile
let mailCaptureDirectory
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
      const newCookies = setCookie.split(',').map(c => c.split(';', 1)[0])
      this.cookieHeader = newCookies.join('; ')
    }

    if (response.status === 204) return { response, payload: null }

    const text = await response.text()
    let payload = null
    try {
        payload = JSON.parse(text)
    } catch (e) {
        console.error('Failed to parse JSON:', text)
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

    childProcess.stderr.on('data', (chunk) => {
      if (!settled) {
        console.error('SERVER STDERR:', chunk.toString())
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

describe('Discord Webhook and Event Integration', () => {
  before(async () => {
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'eso-guild-webhook-tests-'))
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

  it('supports creating, listing, and deleting webhooks', async () => {
    const owner = new SessionClient()

    // Sign up
    await owner.request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'webhook_owner', email: 'owner@example.com', password: 'password1234' },
    })

    // Create guild
    const guildCreate = await owner.request('/api/guilds', {
      method: 'POST',
      body: { name: 'Webhook Guild', weekStartDate: '2026-05-31' },
    })
    const guildId = guildCreate.payload.user.selectedGuildId

    // Create webhook
    const webhookUrl = 'https://discord.com/api/webhooks/123/abc'
    const createWebhook = await owner.request(`/api/guilds/${guildId}/webhooks`, {
      method: 'POST',
      body: {
        url: webhookUrl,
        channelName: '#alerts',
        eventTypes: ['audit_log', 'daily_summary']
      },
    })
    assert.equal(createWebhook.response.status, 201)

    // List webhooks
    const listWebhooks = await owner.request(`/api/guilds/${guildId}/webhooks`)
    assert.equal(listWebhooks.response.status, 200)
    assert.equal(listWebhooks.payload.webhooks.length, 1)
    assert.equal(listWebhooks.payload.webhooks[0].url, webhookUrl)

    const webhookId = listWebhooks.payload.webhooks[0].id

    // Delete webhook
    const deleteWebhook = await owner.request(`/api/guilds/${guildId}/webhooks/${webhookId}`, {
      method: 'DELETE'
    })
    assert.equal(deleteWebhook.response.status, 204)

    // Verify deleted
    const listWebhooksAfter = await owner.request(`/api/guilds/${guildId}/webhooks`)
    assert.equal(listWebhooksAfter.payload.webhooks.length, 0)
  })

  it('supports creating and listing events', async () => {
      const owner = new SessionClient()

      await owner.request('/api/auth/login', {
          method: 'POST',
          body: { username: 'webhook_owner', password: 'password1234' }
      })

      const session = await owner.request('/api/session')
      const guildId = session.payload.user.selectedGuildId

      const eventData = {
          title: 'Trial Night',
          description: 'Weekly vHRC run',
          startTime: '2026-07-10T19:00:00Z',
          endTime: '2026-07-10T21:00:00Z',
          location: 'Hel Ra Citadel',
          maxParticipants: 12,
          recurrence: 'weekly'
      }

      const createEvent = await owner.request(`/api/guilds/${guildId}/events`, {
          method: 'POST',
          body: eventData
      })
      assert.equal(createEvent.response.status, 201)

      const listEvents = await owner.request(`/api/guilds/${guildId}/events`)
      assert.equal(listEvents.response.status, 200)
      assert.ok(listEvents.payload.events.length >= 1)
      assert.equal(listEvents.payload.events[0].title, 'Trial Night')
  })
})
