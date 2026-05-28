"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "RIGHT_CLICK"
  | "DEVTOOLS_OPEN"
  | "CONTEXT_MENU"
  | "WINDOW_BLUR"

interface ProctorOptions {
  attemptId: string
  initialViolations: number
  onViolation: (type: ViolationType, totalCount: number) => void
  enabled?: boolean
}

// Minimum ms between two logs of the same violation type
const DEBOUNCE_MS: Record<ViolationType, number> = {
  TAB_SWITCH:      3000,
  FULLSCREEN_EXIT: 3000,
  COPY_ATTEMPT:    2000,
  PASTE_ATTEMPT:   2000,
  RIGHT_CLICK:     1000,
  DEVTOOLS_OPEN:   10000,
  CONTEXT_MENU:    1000,
  WINDOW_BLUR:     3000,
}

export function useExamProctor({
  attemptId,
  initialViolations,
  onViolation,
  enabled = true,
}: ProctorOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Use refs for everything that shouldn't trigger re-renders or re-run effects
  const countRef          = useRef(initialViolations)
  const lastTimeRef       = useRef<Partial<Record<ViolationType, number>>>({})
  const hasBeenFullscreen = useRef(false)
  const graceActiveRef    = useRef(true)
  const onViolationRef    = useRef(onViolation)
  const attemptIdRef      = useRef(attemptId)
  const enabledRef        = useRef(enabled)
  const cursorExitTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs in sync without triggering effect re-runs
  useEffect(() => { onViolationRef.current  = onViolation }, [onViolation])
  useEffect(() => { attemptIdRef.current    = attemptId   }, [attemptId])
  useEffect(() => { enabledRef.current      = enabled     }, [enabled])

  // Core log function — stable reference, never changes
  const logViolation = useCallback(async (type: ViolationType) => {
    if (!enabledRef.current || graceActiveRef.current) return

    const now  = Date.now()
    const last = lastTimeRef.current[type] ?? 0
    if (now - last < DEBOUNCE_MS[type]) return
    lastTimeRef.current[type] = now

    countRef.current += 1
    const optimistic = countRef.current

    // Notify UI immediately (optimistic)
    onViolationRef.current(type, optimistic)

    // Persist to server — fire and forget, update count from server response
    try {
      const res = await fetch(`/api/attempt/${attemptIdRef.current}/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json() as { violations: number }
        countRef.current = data.violations
        // Only re-notify if server count differs from optimistic
        if (data.violations !== optimistic) {
          onViolationRef.current(type, data.violations)
        }
      }
    } catch {
      // Network error — optimistic count already shown, no retry needed
    }
  }, []) // stable — uses only refs

  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Sync initial fullscreen state
    const fs = Boolean(document.fullscreenElement)
    setIsFullscreen(fs)
    if (fs) hasBeenFullscreen.current = true

    // Grace period — suppress violations during page load / fullscreen entry
    graceActiveRef.current = true
    const graceTimer = setTimeout(() => {
      graceActiveRef.current = false
    }, 1200)

    // ── Handlers ──────────────────────────────────────────────────────────

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

    // Tab switch — visibilitychange is the most reliable signal
    const onVisibility = () => {
      if (document.hidden) void logViolation("TAB_SWITCH")
    }

    const onFullscreenChange = () => {
      const nowFs = Boolean(document.fullscreenElement)
      setIsFullscreen(nowFs)
      if (nowFs) {
        hasBeenFullscreen.current = true
      } else if (hasBeenFullscreen.current) {
        void logViolation("FULLSCREEN_EXIT")
      }
    }

    // Block common cheat shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = /mac/i.test(navigator.userAgent)
      const mod   = isMac ? e.metaKey : e.ctrlKey
      const key   = e.key.toUpperCase()

      const blocked =
        e.key === "F12" ||
        (mod && e.shiftKey && ["I", "J", "C"].includes(key)) ||
        (mod && ["U","S","A","C","V","P"].includes(key)) ||
        (e.altKey && e.key === "Tab") ||
        (e.metaKey && e.key === "Tab")

      if (blocked) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Cursor leaves the browser window — catches overlay-window cheating.
    // We listen on document for mouseleave. In fullscreen, the document
    // fills the screen, so leaving it means the cursor went to another window.
    // We use a 600ms delay to avoid false positives from edge grazing.
    const onMouseLeave = () => {
      if (cursorExitTimer.current) return // already pending
      cursorExitTimer.current = setTimeout(() => {
        cursorExitTimer.current = null
        void logViolation("WINDOW_BLUR")
      }, 600)
    }

    const onMouseEnter = () => {
      if (cursorExitTimer.current) {
        clearTimeout(cursorExitTimer.current)
        cursorExitTimer.current = null
      }
    }

    // DevTools size heuristic — only when in fullscreen
    const devToolsInterval = setInterval(() => {
      if (!document.fullscreenElement) return
      const widthDiff  = window.outerWidth  - window.innerWidth
      const heightDiff = window.outerHeight - window.innerHeight
      if (widthDiff > 160 || heightDiff > 160) {
        void logViolation("DEVTOOLS_OPEN")
      }
    }, 5000)

    document.addEventListener("contextmenu",      onContextMenu)
    document.addEventListener("copy",             onCopy)
    document.addEventListener("paste",            onPaste)
    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    document.addEventListener("keydown",          onKeyDown)
    document.addEventListener("mouseleave",       onMouseLeave)
    document.addEventListener("mouseenter",       onMouseEnter)

    return () => {
      clearTimeout(graceTimer)
      clearInterval(devToolsInterval)
      if (cursorExitTimer.current) {
        clearTimeout(cursorExitTimer.current)
        cursorExitTimer.current = null
      }
      document.removeEventListener("contextmenu",      onContextMenu)
      document.removeEventListener("copy",             onCopy)
      document.removeEventListener("paste",            onPaste)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.removeEventListener("keydown",          onKeyDown)
      document.removeEventListener("mouseleave",       onMouseLeave)
      document.removeEventListener("mouseenter",       onMouseEnter)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [enabled, logViolation]) // logViolation is stable, enabled is a primitive

  return { isFullscreen, requestFullscreen }
}
