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
  /** Only start tracking once monitoring is accepted and exam is active */
  enabled?: boolean
}

// Minimum ms between two logs of the same violation type (per-type debounce)
const DEBOUNCE_MS: Record<ViolationType, number> = {
  TAB_SWITCH:      4000,
  FULLSCREEN_EXIT: 4000,
  COPY_ATTEMPT:    2000,
  PASTE_ATTEMPT:   2000,
  RIGHT_CLICK:     1500,
  DEVTOOLS_OPEN:   15000,
  CONTEXT_MENU:    1500,
  WINDOW_BLUR:     5000,
}

export function useExamProctor({
  attemptId,
  initialViolations,
  onViolation,
  enabled = true,
}: ProctorOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // countRef is initialised ONCE from the prop — never re-initialised on re-render.
  // This prevents the double-count bug where passing violations state as
  // initialViolations would reset the ref on every state update.
  const countRef           = useRef(initialViolations)
  const lastTimeRef        = useRef<Partial<Record<ViolationType, number>>>({})
  const hasBeenFullscreen  = useRef(false)
  const graceActiveRef     = useRef(true)
  const onViolationRef     = useRef(onViolation)
  const attemptIdRef       = useRef(attemptId)
  const enabledRef         = useRef(enabled)
  const cursorExitTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFullscreenRef    = useRef(false)  // sync ref for handlers that can't close over state

  // Keep callback/id refs fresh without re-running the main effect
  useEffect(() => { onViolationRef.current = onViolation }, [onViolation])
  useEffect(() => { attemptIdRef.current   = attemptId   }, [attemptId])
  useEffect(() => { enabledRef.current     = enabled     }, [enabled])

  // ── Core log function — stable, uses only refs ─────────────────────────────
  const logViolation = useCallback(async (type: ViolationType) => {
    if (!enabledRef.current) return
    if (graceActiveRef.current) return

    const now  = Date.now()
    const last = lastTimeRef.current[type] ?? 0
    if (now - last < DEBOUNCE_MS[type]) return
    lastTimeRef.current[type] = now

    countRef.current += 1
    const optimistic = countRef.current

    // Notify UI immediately (optimistic update)
    onViolationRef.current(type, optimistic)

    // Persist to server — fire and forget
    try {
      const res = await fetch(`/api/attempt/${attemptIdRef.current}/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json() as { violations: number; terminated: boolean }
        countRef.current = data.violations
        // Reconcile if server count differs (e.g. concurrent requests)
        if (data.violations !== optimistic) {
          onViolationRef.current(type, data.violations)
        }
        // Server says terminated — just log, don't auto-submit from client
        // (auto-submit on violations is removed; only timer triggers auto-submit)
      }
    } catch {
      // Network error — optimistic count is fine, will reconcile on next success
    }
  }, []) // stable — all dependencies via refs

  // ── Fullscreen helper ──────────────────────────────────────────────────────
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

  // ── Main proctoring effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // Sync fullscreen state on mount
    const currentlyFs = Boolean(document.fullscreenElement)
    setIsFullscreen(currentlyFs)
    isFullscreenRef.current = currentlyFs
    if (currentlyFs) hasBeenFullscreen.current = true

    // Grace period: suppress all violations for the first 2s after the effect
    // mounts. This covers fullscreen entry animation, page transition noise, etc.
    graceActiveRef.current = true
    const graceTimer = setTimeout(() => {
      graceActiveRef.current = false
    }, 2000)

    // ── Event handlers ─────────────────────────────────────────────────────

    // Context menu — preventDefault + log as RIGHT_CLICK (covers both mouse right-click
    // and the context menu keyboard key). We don't log CONTEXT_MENU separately to avoid
    // double-counting the same physical action.
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      void logViolation("RIGHT_CLICK")
    }

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      void logViolation("COPY_ATTEMPT")
    }

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      void logViolation("PASTE_ATTEMPT")
    }

    // Tab switch — visibilitychange is the most reliable cross-browser signal.
    // Only log when enabled and not in grace period (handled inside logViolation).
    const onVisibility = () => {
      if (document.hidden) void logViolation("TAB_SWITCH")
    }

    const onFullscreenChange = () => {
      const nowFs = Boolean(document.fullscreenElement)
      setIsFullscreen(nowFs)
      isFullscreenRef.current = nowFs
      if (nowFs) {
        hasBeenFullscreen.current = true
        // Reset grace after re-entering fullscreen so the enter animation
        // doesn't immediately log a blur
        graceActiveRef.current = true
        setTimeout(() => { graceActiveRef.current = false }, 1000)
      } else if (hasBeenFullscreen.current) {
        // Only log if they had previously entered fullscreen (not on initial page load)
        void logViolation("FULLSCREEN_EXIT")
      }
    }

    // Block common cheating keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = /mac/i.test(navigator.userAgent)
      const mod   = isMac ? e.metaKey : e.ctrlKey
      const key   = e.key.toUpperCase()

      const blocked =
        e.key === "F12" ||
        (mod && e.shiftKey && ["I", "J", "C"].includes(key)) ||  // devtools
        (mod && ["U", "S", "A", "C", "V", "P"].includes(key)) || // view-source, save, select-all, copy, paste, print
        (e.altKey && e.key === "Tab") ||
        (e.metaKey && e.key === "Tab")

      if (blocked) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Cursor leaving the viewport — only meaningful in fullscreen.
    // In fullscreen the document fills the entire screen; mouseleave on
    // documentElement means the cursor went off-screen (another monitor, overlay app).
    // 800ms delay avoids false positives from grazing the edge.
    const onMouseLeave = () => {
      if (!isFullscreenRef.current) return  // not meaningful outside fullscreen
      if (cursorExitTimer.current) return   // already pending
      cursorExitTimer.current = setTimeout(() => {
        cursorExitTimer.current = null
        if (isFullscreenRef.current) void logViolation("WINDOW_BLUR")
      }, 800)
    }

    const onMouseEnter = () => {
      if (cursorExitTimer.current) {
        clearTimeout(cursorExitTimer.current)
        cursorExitTimer.current = null
      }
    }

    // DevTools size heuristic — gap between outerWidth and innerWidth > 160px
    // usually means DevTools is docked. Only meaningful in fullscreen.
    const devToolsInterval = setInterval(() => {
      if (!isFullscreenRef.current) return
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
    document.documentElement.addEventListener("mouseleave", onMouseLeave)
    document.documentElement.addEventListener("mouseenter", onMouseEnter)

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
      document.documentElement.removeEventListener("mouseleave", onMouseLeave)
      document.documentElement.removeEventListener("mouseenter", onMouseEnter)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [enabled, logViolation])

  return { isFullscreen, requestFullscreen }
}
