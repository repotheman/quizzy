"use client"

import { useEffect, useRef } from "react"

interface UseTimerOptions {
  initialSeconds: number
  onTick?: (seconds: number) => void
  onExpire?: () => void
}

/**
 * Countdown timer anchored to wall-clock time.
 * initialSeconds is fixed at mount — changing the prop has no effect.
 */
export function useTimer({ initialSeconds, onTick, onExpire }: UseTimerOptions) {
  const onTickRef   = useRef(onTick)
  const onExpireRef = useRef(onExpire)
  const firedRef    = useRef(false)

  useEffect(() => { onTickRef.current   = onTick   }, [onTick])
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    if (initialSeconds <= 0) {
      onTickRef.current?.(0)
      if (!firedRef.current) {
        firedRef.current = true
        onExpireRef.current?.()
      }
      return
    }

    const startWall = performance.now()

    const tick = () => {
      const elapsed   = Math.floor((performance.now() - startWall) / 1000)
      const remaining = Math.max(0, initialSeconds - elapsed)
      onTickRef.current?.(remaining)
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true
        clearInterval(id)
        onExpireRef.current?.()
      }
    }

    const id = setInterval(tick, 1000)
    tick() // fire immediately so UI shows correct value on mount

    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — timer is fixed at mount
}

export function formatTime(seconds: number): string {
  const s    = Math.max(0, seconds)
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}
