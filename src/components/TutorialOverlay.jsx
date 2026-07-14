import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'

const overlayPadding = 14
const viewportPadding = 20

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function buildClipPath(rect) {
  if (!rect) {
    return undefined
  }

  const left = Math.max(rect.left, 0)
  const top = Math.max(rect.top, 0)
  const right = Math.max(rect.right, left)
  const bottom = Math.max(rect.bottom, top)

  return `polygon(0% 0%, 0% 100%, ${left}px 100%, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px 100%, 100% 100%, 100% 0%)`
}

function getTargetRect(targetRef) {
  const element = targetRef?.current
  if (!element) {
    return null
  }

  const bounds = element.getBoundingClientRect()
  if (bounds.width === 0 || bounds.height === 0) {
    return null
  }

  return {
    left: Math.max(bounds.left - overlayPadding, viewportPadding),
    top: Math.max(bounds.top - overlayPadding, viewportPadding),
    right: Math.min(bounds.right + overlayPadding, window.innerWidth - viewportPadding),
    bottom: Math.min(bounds.bottom + overlayPadding, window.innerHeight - viewportPadding),
    width: Math.min(bounds.width + overlayPadding * 2, window.innerWidth - viewportPadding * 2),
    height: Math.min(bounds.height + overlayPadding * 2, window.innerHeight - viewportPadding * 2),
  }
}

function getCardPosition(rect) {
  const cardWidth = Math.min(360, window.innerWidth - viewportPadding * 2)

  if (!rect) {
    return {
      left: clamp((window.innerWidth - cardWidth) / 2, viewportPadding, window.innerWidth - cardWidth - viewportPadding),
      top: clamp(window.innerHeight * 0.2, viewportPadding, window.innerHeight - 260),
      width: cardWidth,
    }
  }

  const preferredLeft = rect.right + 24
  const fitsRight = preferredLeft + cardWidth <= window.innerWidth - viewportPadding

  return {
    left: fitsRight
      ? preferredLeft
      : clamp(rect.left + rect.width / 2 - cardWidth / 2, viewportPadding, window.innerWidth - cardWidth - viewportPadding),
    top: clamp(rect.top, viewportPadding, window.innerHeight - 260),
    width: cardWidth,
  }
}

function TutorialOverlay({ open, steps, onFinish }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const resetStepTimeout = window.setTimeout(() => {
      setActiveStepIndex(0)
    }, 0)

    return () => {
      window.clearTimeout(resetStepTimeout)
    }
  }, [open])

  const activeStep = open ? steps[activeStepIndex] : null

  useEffect(() => {
    if (!open || !activeStep) {
      return undefined
    }

    const updateRect = () => {
      setTargetRect(getTargetRect(activeStep.targetRef))
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [activeStep, open])

  const cardPosition = useMemo(() => getCardPosition(targetRect), [targetRect])

  if (!open || !activeStep) {
    return null
  }

  const isLastStep = activeStepIndex === steps.length - 1

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.tooltip + 1000,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: 'rgba(5, 8, 12, 0.72)',
          backdropFilter: 'blur(3px)',
          clipPath: buildClipPath(targetRect),
          transition: 'clip-path 180ms ease, background-color 180ms ease',
        }}
      />
      {targetRect && (
        <Box
          sx={{
            position: 'absolute',
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.right - targetRect.left,
            height: targetRect.bottom - targetRect.top,
            borderRadius: 3,
            border: '1px solid rgba(173, 216, 255, 0.9)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 32px rgba(93, 173, 226, 0.28)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            transition: 'left 180ms ease, top 180ms ease, width 180ms ease, height 180ms ease',
          }}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          left: cardPosition.left,
          top: cardPosition.top,
          width: cardPosition.width,
          maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
          borderRadius: 4,
          border: '1px solid rgba(145, 196, 255, 0.24)',
          background: 'linear-gradient(180deg, rgba(17, 29, 43, 0.96), rgba(9, 16, 24, 0.98))',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
          color: 'common.white',
          p: 3,
          pointerEvents: 'auto',
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(145, 196, 255, 0.9)', letterSpacing: '0.12em' }}>
              Guided Tour
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {activeStep.title}
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: 'rgba(232, 240, 255, 0.88)', lineHeight: 1.7 }}>
            {activeStep.body}
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: "center"
            }}>
            <Typography variant="caption" sx={{ color: 'rgba(232, 240, 255, 0.58)' }}>
              Step {activeStepIndex + 1} of {steps.length}
            </Typography>

            <Stack direction="row" spacing={1}>
              <Button color="inherit" onClick={onFinish}>
                Skip
              </Button>
              <Button
                color="inherit"
                disabled={activeStepIndex === 0}
                onClick={() => setActiveStepIndex((index) => Math.max(index - 1, 0))}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (isLastStep) {
                    onFinish()
                    return
                  }

                  setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1))
                }}
              >
                {isLastStep ? 'Start' : 'Next'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export default TutorialOverlay