import { differenceInSeconds } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendanceStatus = "NOT_JOINED" | "IN_PROGRESS" | "COMPLETED"
export type WindowStatus = "UPCOMING" | "OPEN" | "CLOSED" | "NO_WINDOW_SET"

export interface AttendanceRecord {
  internId: string
  internName: string
  internEmail: string
  status: AttendanceStatus
  joinedAt: string | null
  startedAt: string | null
  attemptStatus: string | null
  violations: number
}

export interface AttendanceSummary {
  total: number
  inProgress: number
  notJoined: number
  completed: number
  joined: number
  joinRate: number
}

export interface AttendanceResponse {
  quiz: {
    id: string
    title: string
    timeLimitMinutes: number
    startAt: string | null
    endAt: string | null
  }
  interns: AttendanceRecord[]
  fetchedAt: string
}

// ─── Pure utility functions ───────────────────────────────────────────────────

/**
 * Classify an intern's attendance status based on their assignment and attempt data.
 *
 * Rules:
 * - joinedAt is null → NOT_JOINED (never started)
 * - joinedAt is set + attemptStatus === 'IN_PROGRESS' → IN_PROGRESS
 * - joinedAt is set + attemptStatus is SUBMITTED/TIMED_OUT/TERMINATED → COMPLETED
 * - joinedAt is set but no attempt row (attemptStatus null) → NOT_JOINED (edge case)
 */
export function classifyIntern(row: {
  joinedAt: string | null
  attemptStatus: string | null
}): AttendanceStatus {
  if (!row.joinedAt) return "NOT_JOINED"
  if (row.attemptStatus === "IN_PROGRESS") return "IN_PROGRESS"
  if (
    row.attemptStatus === "SUBMITTED" ||
    row.attemptStatus === "TIMED_OUT" ||
    row.attemptStatus === "TERMINATED"
  ) {
    return "COMPLETED"
  }
  // joinedAt set but no attempt row yet
  return "NOT_JOINED"
}

/**
 * Determine the current exam window status based on startAt/endAt timestamps.
 */
export function getWindowStatus(
  startAt: string | null,
  endAt: string | null,
  now: Date = new Date()
): WindowStatus {
  if (!startAt || !endAt) return "NO_WINDOW_SET"
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (now < start) return "UPCOMING"
  if (now > end) return "CLOSED"
  return "OPEN"
}

/**
 * Compute aggregate summary counts from an array of attendance records.
 */
export function computeSummary(interns: AttendanceRecord[]): AttendanceSummary {
  const inProgress = interns.filter((i) => i.status === "IN_PROGRESS").length
  const notJoined = interns.filter((i) => i.status === "NOT_JOINED").length
  const completed = interns.filter((i) => i.status === "COMPLETED").length
  const total = interns.length
  const joined = inProgress + completed
  const joinRate = total > 0 ? Math.round((joined / total) * 100) : 0
  return { total, inProgress, notJoined, completed, joined, joinRate }
}

/**
 * Format elapsed time since startedAt as "Xm Ys".
 * e.g. 65 seconds → "1m 5s"
 */
export function formatElapsed(startedAt: string): string {
  const seconds = differenceInSeconds(new Date(), new Date(startedAt))
  const nonNegative = Math.max(0, seconds)
  const m = Math.floor(nonNegative / 60)
  const s = nonNegative % 60
  return `${m}m ${s}s`
}
