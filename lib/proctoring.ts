"use client"

import { useEffect, useCallback, useRef } from 'react'

export type ViolationType =
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'COPY_ATTEMPT'
  | 'PASTE_ATTEMPT'
  | 'RIGHT_CLICK'
  | 'DEVTOOLS_OPEN'
  | 'WINDOW_BLUR'
  | 'CONTEXT_MENU'

export interface Violation {
  type: ViolationType
  description: string
  timestamp: Date
}

interface UseProctoringOptions {
  onViolation: (violation: Violation) => void
  onTerminate?: () => void
  maxViolations?: number
  enabled?: boolean
}

export function useProctoring({
  onViolation,
  onTerminate,
  maxViolations = 5,
  enabled = true,
}: UseProctoringOptions) {
  const violationCountRef = useRef(0)
  const devToolsOpenRef = useRef(false)

  const recordViolation = useCallback(
    (type: ViolationType, description: string) => {
      if (!enabled) return

      const violation: Violation = {
        type,
        description,
        timestamp: new Date(),
      }
      onViolation(violation)

      violationCountRef.current += 1
      if (violationCountRef.current >= maxViolations && onTerminate) {
        onTerminate()
      }
    },
    [enabled, maxViolations, onViolation, onTerminate]
  )

  useEffect(() => {
    if (!enabled) return

    // Detect tab/window visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('TAB_SWITCH', 'User switched to another tab or minimized the window')
      }
    }

    // Detect window blur (clicking outside browser)
    const handleWindowBlur = () => {
      recordViolation('WINDOW_BLUR', 'User clicked outside the browser window')
    }

    // Detect fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('FULLSCREEN_EXIT', 'User exited fullscreen mode')
      }
    }

    // Prevent copy
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      recordViolation('COPY_ATTEMPT', 'User attempted to copy content')
    }

    // Prevent paste
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      recordViolation('PASTE_ATTEMPT', 'User attempted to paste content')
    }

    // Prevent right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      recordViolation('CONTEXT_MENU', 'User attempted to open context menu')
    }

    // Detect devtools
    const detectDevTools = () => {
      const threshold = 160
      const widthThreshold = window.outerWidth - window.innerWidth > threshold
      const heightThreshold = window.outerHeight - window.innerHeight > threshold

      if (widthThreshold || heightThreshold) {
        if (!devToolsOpenRef.current) {
          devToolsOpenRef.current = true
          recordViolation('DEVTOOLS_OPEN', 'Developer tools were detected as open')
        }
      } else {
        devToolsOpenRef.current = false
      }
    }

    // Prevent keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes("Mac")
      const modifierKey = isMac ? e.metaKey : e.ctrlKey

      // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (modifierKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (modifierKey && e.key === 'u') ||
        (modifierKey && e.key === 'c') ||
        (modifierKey && e.key === 'v') ||
        (modifierKey && e.key === 'a')
      ) {
        e.preventDefault()
        if (e.key === 'F12' || (modifierKey && e.shiftKey)) {
          recordViolation('DEVTOOLS_OPEN', 'User attempted to open developer tools via keyboard shortcut')
        } else if (modifierKey && e.key === 'c') {
          recordViolation('COPY_ATTEMPT', 'User attempted to copy using keyboard shortcut')
        } else if (modifierKey && e.key === 'v') {
          recordViolation('PASTE_ATTEMPT', 'User attempted to paste using keyboard shortcut')
        }
      }
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    // Check for devtools periodically
    const devToolsInterval = setInterval(detectDevTools, 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      clearInterval(devToolsInterval)
    }
  }, [enabled, recordViolation])

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
      return true
    } catch {
      return false
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
      return true
    } catch {
      return false
    }
  }, [])

  const resetViolationCount = useCallback(() => {
    violationCountRef.current = 0
  }, [])

  return {
    enterFullscreen,
    exitFullscreen,
    resetViolationCount,
    violationCount: violationCountRef.current,
  }
}

export function formatViolationType(type: ViolationType): string {
  const labels: Record<ViolationType, string> = {
    TAB_SWITCH: 'Tab Switch',
    FULLSCREEN_EXIT: 'Fullscreen Exit',
    COPY_ATTEMPT: 'Copy Attempt',
    PASTE_ATTEMPT: 'Paste Attempt',
    RIGHT_CLICK: 'Right Click',
    DEVTOOLS_OPEN: 'DevTools Open',
    WINDOW_BLUR: 'Window Blur',
    CONTEXT_MENU: 'Context Menu',
  }
  return labels[type] || type
}
