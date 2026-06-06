import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const suppressedWarnings = ['justifyContent', 'alignItems', 'flexWrap', 'InputLabelProps']

const originalConsoleError = console.error
console.error = (...args) => {
	const fullMessage = args.map((value) => String(value)).join(' ')

	if (
		fullMessage.includes('React does not recognize the') &&
		suppressedWarnings.some((message) => fullMessage.includes(message))
	) {
		return
	}

	originalConsoleError(...args)
}

afterEach(() => {
	cleanup()
})