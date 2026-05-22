"use client"

import { useEffect, useRef, useCallback } from "react"

interface UseTimerOptions {
  initialSeconds: number
  onTick?: (seconds: number) => void
  onExpire?: () => void
  autoStart?: boolean
}

export function useTimer({
  initialSeconds,
  onTick,
  onExpire,
  autoStart = true,
}: UseTimerOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const secondsRef = useRef(initialSeconds)
  const isRunningRef = useRef(false)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    isRunningRef.current = false
  }, [])

  const start = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    timerRef.current = setInterval(() => {
      secondsRef.current -= 1
      onTick?.(secondsRef.current)

      if (secondsRef.current <= 0) {
        stop()
        onExpire?.()
      }
    }, 1000)
  }, [onTick, onExpire, stop])

  const reset = useCallback((newSeconds: number) => {
    stop()
    secondsRef.current = newSeconds
    onTick?.(newSeconds)
  }, [stop, onTick])

  useEffect(() => {
    secondsRef.current = initialSeconds
    if (autoStart && initialSeconds > 0) {
      start()
    }
    return () => stop()
  }, [initialSeconds, autoStart, start, stop])

  return {
    start,
    stop,
    reset,
    getSeconds: () => secondsRef.current,
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
