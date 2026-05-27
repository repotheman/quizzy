"use client"

import { useEffect, useRef, useCallback, useState } from "react"

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "RIGHT_CLICK"
  | "DEVTOOLS_OPEN"
  | "CONTEXT_MENU"

interface ProctorOptions {
  attemptId: string
  currentViolations: number
  /** Called after a violation is logged with the updated count. */
  onViolation: (type: ViolationType, newCount: number) => void
  enabled?: boolean
}

export function useExamProctor({
  attemptId,
  currentViolations,
  onViolation,
  enabled = true,
}: ProctorOptions) {
  const violationCount        = useRef(currentViolations)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const lastViolationTime     = useRef<Record<string, number>>({})
  // Only log FULLSCREEN_EXIT after the student has entered fullscreen at least once
  const hasEnteredFullscreen  = useRef(false)
  // Short grace period on mount to ignore events fired during page load
  const mountGrace            = useRef(true)

  useEffect(() => { violationCount.current = currentViolations }, [currentViolations])

  const logViolation = useCallback(async (type: ViolationType) => {
    if (!enabled || mountGrace.current) return

    // Debounce: 2s between same violation type
    const now = Date.now()
    if (now - (lastViolationTime.current[type] ?? 0) < 2000) return
    lastViolationTime.current[type] = now

    violationCount.current += 1
    const optimisticCount = violationCount.current

    try {
      const res = await fetch(`/api/attempt/${attemptId}/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json() as { violations: number }
        violationCount.current = data.violations
        onViolation(type, data.violations)
      } else {
        onViolation(type, optimisticCount)
      }
    } catch {
      onViolation(type, optimisticCount)
    }
  }, [attemptId, onViolation, enabled])

  // Expose a requestFullscreen helper — must be called from a user gesture
  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      return true
    } catch {
      return false
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    // Sync initial fullscreen state (document is only available client-side)
    const alreadyFullscreen = Boolean(document.fullscreenElement)
    setIsFullscreen(alreadyFullscreen)
    if (alreadyFullscreen) hasEnteredFullscreen.current = true

    // Grace period: ignore events for the first 600ms after mount
    const graceTimer = setTimeout(() => { mountGrace.current = false }, 600)

    // ── Event handlers ────────────────────────────────────────────────────

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      void logViolation("CONTEXT_MENU")
    }

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      void logViolation("COPY_ATTEMPT")
    }

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      void logViolation("PASTE_ATTEMPT")
    }

    const onVisibility = () => {
      if (document.hidden) void logViolation("TAB_SWITCH")
    }

    const onFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement)
      setIsFullscreen(fs)
      if (fs) {
        hasEnteredFullscreen.current = true
      } else if (hasEnteredFullscreen.current) {
        // Only log exit after the student has been in fullscreen at least once
        void logViolation("FULLSCREEN_EXIT")
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC")
      const mod   = isMac ? e.metaKey : e.ctrlKey
      const shouldBlock =
        e.key === "F12" ||
        (mod && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (mod && ["u","U","s","S","a","A","c","C","v","V","p","P"].includes(e.key)) ||
        (e.altKey && e.key === "Tab") ||
        (e.metaKey && e.key === "Tab")

      if (shouldBlock) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // DevTools heuristic — only fires when in fullscreen to avoid false positives
    const devToolsInterval = setInterval(() => {
      if (!document.fullscreenElement) return
      if (
        window.outerWidth  - window.innerWidth  > 160 ||
        window.outerHeight - window.innerHeight > 160
      ) {
        void logViolation("DEVTOOLS_OPEN")
      }
    }, 5000)

    document.addEventListener("contextmenu",      onContextMenu)
    document.addEventListener("copy",             onCopy)
    document.addEventListener("paste",            onPaste)
    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    document.addEventListener("keydown",          onKeyDown)

    return () => {
      clearTimeout(graceTimer)
      clearInterval(devToolsInterval)
      document.removeEventListener("contextmenu",      onContextMenu)
      document.removeEventListener("copy",             onCopy)
      document.removeEventListener("paste",            onPaste)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.removeEventListener("keydown",          onKeyDown)
      // Exit fullscreen when exam unmounts (submit / timer expire)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [logViolation, enabled])

  return { isFullscreen, requestFullscreen }
}
