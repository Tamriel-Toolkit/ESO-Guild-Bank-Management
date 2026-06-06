import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TutorialOverlay from './TutorialOverlay'

function createTargetRef() {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => ({
    left: 40,
    top: 80,
    right: 200,
    bottom: 160,
    width: 160,
    height: 80,
  })
  document.body.appendChild(element)
  const ref = createRef()
  ref.current = element
  return ref
}

describe('TutorialOverlay', () => {
  it('walks through steps and finishes from the Start button', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const steps = [
      { title: 'Step One', body: 'First body', targetRef: createTargetRef() },
      { title: 'Step Two', body: 'Second body', targetRef: createTargetRef() },
    ]

    render(<TutorialOverlay open steps={steps} onFinish={onFinish} />)

    expect(screen.getByText('Step One')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('Step Two')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Step One')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})