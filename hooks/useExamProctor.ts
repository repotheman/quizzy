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
  /** Called after a violation is logged. Receives updated count and whether attempt was terminated. */
  onViolation: (type: ViolationType, newCount: number, terminated: boolean) => void
  enabled?: boolean
}

export function useExamProctor({
  attemptId,
  currentViolations,
  onViolation,
  enabled = true,
}: ProctorOptions) {
  const violationCount    = useRef(currentViolations)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const lastViolationTime = useRef<Record<string, number>>({})
  const isFullscreenRef   = useRef(false)
  const mountGraceRef     = useRef(true)
  // Prevent logging after termination
  const terminatedRef     = useRef(false)

  useEffect(() => { violationCount.current = currentViolations }, [currentViolations])
  useEffect(() => { isFullscreenRef.current = isFullscreen },     [isFullscreen])

  const logViolation = useCallback(async (type: ViolationType) => {
    if (!enabled || mountGraceRef.current || terminatedRef.current) return

    // Per-type debounce: 1.5s between same violation type
    const now = Date.now()
    if (now - (lastViolationTime.current[type] ?? 0) < 1500) return
    lastViolationTime.current[type] = now

    // Only log non-fullscreen-exit violations when actually in fullscreen
    // (prevents false positives during page load / before fullscreen is entered)
    if (!isFullscreenRef.current && type !== "FULLSCREEN_EXIT") return

    violationCount.current += 1
    const newCount = violationCount.current

    try {
      const res = await fetch(`/api/attempt/${attemptId}/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })

      if (res.ok) {
        const data = await res.json() as { violations: number; terminated: boolean }
        violationCount.current = data.violations
        if (data.terminated) terminatedRef.current = true
        onViolation(type, data.violations, data.terminated)
      } else {
        // API failed — still notify UI with local count, not terminated
        onViolation(type, newCount, false)
      }
    } catch {
      // Network error — still notify UI with local count
      onViolation(type, newCount, false)
    }
  }, [attemptId, onViolation, enabled])

  const requestFullscreen = useCallback(async () => {
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

    setIsFullscreen(Boolean(document.fullscreenElement))

    // Grace period on mount to avoid false positives from page load events
    const graceTimer = setTimeout(() => {
      mountGraceRef.current = false
    }, 1500)

    const handleContextMenu  = (e: MouseEvent)    => { e.preventDefault(); void logViolation("CONTEXT_MENU") }
    const handleCopy         = (e: ClipboardEvent) => { e.preventDefault(); void logViolation("COPY_ATTEMPT") }
    const handlePaste        = (e: ClipboardEvent) => { e.preventDefault(); void logViolation("PASTE_ATTEMPT") }
    const handleVisibility   = () => { if (document.hidden) void logViolation("TAB_SWITCH") }

    const handleFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement)
      setIsFullscreen(fs)
      isFullscreenRef.current = fs
      if (!fs) void logViolation("FULLSCREEN_EXIT")
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes("Mac")
      const mod   = isMac ? e.metaKey : e.ctrlKey
      const blocked = [
        e.key === "F12",
        mod && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase()),
        mod && ["u","U","s","S","a","A","c","C","v","V","p","P"].includes(e.key),
        e.altKey && e.key === "Tab",
        e.metaKey && e.key === "Tab",
      ]
      if (blocked.some(Boolean)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // DevTools detection — check every 5s, only when in fullscreen
    const devToolsCheck = setInterval(() => {
      if (!isFullscreenRef.current) return
      if (
        window.outerWidth  - window.innerWidth  > 160 ||
        window.outerHeight - window.innerHeight > 160
      ) {
        void logViolation("DEVTOOLS_OPEN")
      }
    }, 5000)

    document.addEventListener("contextmenu",      handleContextMenu)
    document.addEventListener("copy",             handleCopy)
    document.addEventListener("paste",            handlePaste)
    document.addEventListener("visibilitychange", handleVisibility)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("keydown",          handleKeyDown)

    return () => {
      clearTimeout(graceTimer)
      clearInterval(devToolsCheck)
      document.removeEventListener("contextmenu",      handleContextMenu)
      document.removeEventListener("copy",             handleCopy)
      document.removeEventListener("paste",            handlePaste)
      document.removeEventListener("visibilitychange", handleVisibility)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("keydown",          handleKeyDown)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [logViolation, enabled])

  return { isFullscreen, requestFullscreen }
}
