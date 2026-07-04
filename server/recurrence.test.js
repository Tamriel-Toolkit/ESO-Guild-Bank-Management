import { test } from 'node:test'
import assert from 'node:assert'

// Simple mock of the expansion logic from server/index.js
function expandRecurringEvents(event, startLimit, endLimit) {
  const instances = []
  const eventStart = new Date(event.startTime)
  const eventEnd = new Date(event.endTime)
  const duration = eventEnd.getTime() - eventStart.getTime()

  if (event.recurrenceRule === 'none') {
    if (event.startTime < endLimit && event.endTime > startLimit) {
      instances.push(event)
    }
    return instances
  }

  let current = new Date(eventStart)
  let count = 0
  const maxInstances = 500

  while (current.toISOString() < endLimit && count < maxInstances) {
    const currentEnd = new Date(current.getTime() + duration)
    const occurrenceDate = current.toISOString().slice(0, 10)

    if (currentEnd.toISOString() > startLimit) {
      instances.push({
        ...event,
        startTime: current.toISOString(),
        endTime: currentEnd.toISOString(),
        occurrenceDate,
      })
    }

    if (event.recurrenceRule === 'daily') {
      current.setDate(current.getDate() + 1)
    } else if (event.recurrenceRule === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else {
      break
    }
    count++
  }

  return instances
}

test('expandRecurringEvents - none', () => {
  const event = {
    startTime: '2023-01-01T10:00:00Z',
    endTime: '2023-01-01T12:00:00Z',
    recurrenceRule: 'none'
  }
  const startLimit = '2023-01-01T00:00:00Z'
  const endLimit = '2023-01-02T00:00:00Z'

  const instances = expandRecurringEvents(event, startLimit, endLimit)
  assert.strictEqual(instances.length, 1)
  assert.strictEqual(instances[0].startTime, event.startTime)
})

test('expandRecurringEvents - daily', () => {
  const event = {
    startTime: '2023-01-01T10:00:00Z',
    endTime: '2023-01-01T12:00:00Z',
    recurrenceRule: 'daily'
  }
  const startLimit = '2023-01-01T00:00:00Z'
  const endLimit = '2023-01-04T00:00:00Z' // Should get Jan 1, 2, 3

  const instances = expandRecurringEvents(event, startLimit, endLimit)
  assert.strictEqual(instances.length, 3)
  assert.strictEqual(instances[0].occurrenceDate, '2023-01-01')
  assert.strictEqual(instances[1].occurrenceDate, '2023-01-02')
  assert.strictEqual(instances[2].occurrenceDate, '2023-01-03')
})

test('expandRecurringEvents - weekly', () => {
  const event = {
    startTime: '2023-01-01T10:00:00Z',
    endTime: '2023-01-01T12:00:00Z',
    recurrenceRule: 'weekly'
  }
  const startLimit = '2023-01-01T00:00:00Z'
  const endLimit = '2023-01-16T00:00:00Z' // Should get Jan 1, 8, 15

  const instances = expandRecurringEvents(event, startLimit, endLimit)
  assert.strictEqual(instances.length, 3)
  assert.strictEqual(instances[0].occurrenceDate, '2023-01-01')
  assert.strictEqual(instances[1].occurrenceDate, '2023-01-08')
  assert.strictEqual(instances[2].occurrenceDate, '2023-01-15')
})
