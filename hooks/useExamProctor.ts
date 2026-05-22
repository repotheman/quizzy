"use client"

import { useEffect, useRef, useCallback } from "react"

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "RIGHT_CLICK"
  | "DEVTOOLS_OPEN"
  | "WINDOW_BLUR"
  | "CONTEXT_MENU"

interface ProctorOptions {
  attemptId: string
  maxViolations: number
  currentViolations: number
  onTerminate: () => void
  onViolation: (type: ViolationType, count: number) => void
  enabled?: boolean
}

export function useExamProctor({
  attemptId,
  maxViolations,
  currentViolations,
  onTerminate,
  onViolation,
  enabled = true,
}: ProctorOptions) {
  const violationCount = useRef(currentViolations)
  const hasTerminated = useRef(false)

  // Update the ref when currentViolations changes
  useEffect(() => {
    violationCount.current = currentViolations
  }, [currentViolations])

  const logViolation = useCallback(
    async (type: ViolationType) => {
      if (hasTerminated.current || !enabled) return

      violationCount.current += 1
      const currentCount = violationCount.current

      try {
        await fetch(`/api/attempt/${attemptId}/violation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        })
      } catch (error) {
        console.error("Failed to log violation:", error)
      }

      onViolation(type, currentCount)

      if (currentCount >= maxViolations) {
        hasTerminated.current = true
        onTerminate()
      }
    },
    [attemptId, maxViolations, onTerminate, onViolation, enabled]
  )

  useEffect(() => {
    if (!enabled) return

    // Request fullscreen
    const requestFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen()
      } catch {
        // User may have denied fullscreen
      }
    }
    requestFullscreen()

    // Event handlers
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      logViolation("CONTEXT_MENU")
    }

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      logViolation("COPY_ATTEMPT")
    }

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      logViolation("PASTE_ATTEMPT")
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation("TAB_SWITCH")
      }
    }

    const handleBlur = () => {
      logViolation("WINDOW_BLUR")
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation("FULLSCREEN_EXIT")
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const blocked = [
        e.key === "F12",
        e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase()),
        e.ctrlKey && ["u", "U", "s", "S", "a", "A", "c", "C", "v", "V", "p", "P"].includes(e.key),
        e.altKey && e.key === "Tab",
        e.metaKey && e.key === "Tab",
      ]
      if (blocked.some(Boolean)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // DevTools detection
    const devToolsCheck = setInterval(() => {
      const threshold = 160
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        logViolation("DEVTOOLS_OPEN")
      }
    }, 3000)

    // Add event listeners
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("blur", handleBlur)

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("blur", handleBlur)
      clearInterval(devToolsCheck)
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [logViolation, enabled])
}
