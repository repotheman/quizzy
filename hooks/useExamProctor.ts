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
  onViolation: (type: ViolationType) => void
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

  useEffect(() => { violationCount.current = currentViolations }, [currentViolations])
  useEffect(() => { isFullscreenRef.current = isFullscreen },     [isFullscreen])

  const logViolation = useCallback(async (type: ViolationType) => {
    if (!enabled || mountGraceRef.current) return

    const now = Date.now()
    if (now - (lastViolationTime.current[type] || 0) < 1500) return
    lastViolationTime.current[type] = now

    // Only log non-fullscreen-exit violations when actually in fullscreen
    if (!isFullscreenRef.current && type !== "FULLSCREEN_EXIT") return

    violationCount.current += 1

    try {
      await fetch(`/api/attempt/${attemptId}/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
    } catch {
      // fire-and-forget — violation count is still incremented locally
    }

    onViolation(type)
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

    const graceTimer = setTimeout(() => {
      mountGraceRef.current = false
    }, 1500)

    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); logViolation("CONTEXT_MENU") }
    const handleCopy        = (e: ClipboardEvent) => { e.preventDefault(); logViolation("COPY_ATTEMPT") }
    const handlePaste       = (e: ClipboardEvent) => { e.preventDefault(); logViolation("PASTE_ATTEMPT") }
    const handleVisibility  = () => { if (document.hidden) logViolation("TAB_SWITCH") }

    const handleFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement)
      setIsFullscreen(fs)
      isFullscreenRef.current = fs
      if (!fs) logViolation("FULLSCREEN_EXIT")
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes("Mac")
      const mod   = isMac ? e.metaKey : e.ctrlKey
      const blocked = [
        e.key === "F12",
        mod && e.shiftKey && ["I","J","C"].includes(e.key.toUpperCase()),
        mod && ["u","U","s","S","a","A","c","C","v","V","p","P"].includes(e.key),
        e.altKey && e.key === "Tab",
        e.metaKey && e.key === "Tab",
      ]
      if (blocked.some(Boolean)) { e.preventDefault(); e.stopPropagation() }
    }

    const devToolsCheck = setInterval(() => {
      if (!isFullscreenRef.current) return
      if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
        logViolation("DEVTOOLS_OPEN")
      }
    }, 5000)

    document.addEventListener("contextmenu",    handleContextMenu)
    document.addEventListener("copy",           handleCopy)
    document.addEventListener("paste",          handlePaste)
    document.addEventListener("visibilitychange", handleVisibility)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("keydown",        handleKeyDown)

    return () => {
      clearTimeout(graceTimer)
      clearInterval(devToolsCheck)
      document.removeEventListener("contextmenu",    handleContextMenu)
      document.removeEventListener("copy",           handleCopy)
      document.removeEventListener("paste",          handlePaste)
      document.removeEventListener("visibilitychange", handleVisibility)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("keydown",        handleKeyDown)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [logViolation, enabled])

  return { isFullscreen, requestFullscreen }
}
