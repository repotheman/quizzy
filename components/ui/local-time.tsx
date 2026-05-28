"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"

interface LocalTimeProps {
  /** ISO string or Date — rendered in the browser's local timezone */
  date: string | Date
  /** date-fns format string, default: "MMM d, yyyy h:mm a" */
  fmt?: string
  className?: string
}

/**
 * Renders a timestamp in the user's local timezone.
 *
 * Renders nothing on the server (avoids hydration mismatch between server
 * timezone and user's browser timezone). The formatted time appears after
 * the first client-side render.
 */
export function LocalTime({ date, fmt = "MMM d, yyyy h:mm a", className }: LocalTimeProps) {
  const [formatted, setFormatted] = useState<string | null>(null)

  useEffect(() => {
    setFormatted(format(new Date(date), fmt))
  }, [date, fmt])

  if (!formatted) {
    // Render a non-breaking space as placeholder to avoid layout shift
    return <span className={className}>&nbsp;</span>
  }

  return <span className={className}>{formatted}</span>
}
