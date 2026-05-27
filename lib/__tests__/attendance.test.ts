import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import {
  classifyIntern,
  getWindowStatus,
  computeSummary,
  formatElapsed,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../attendance'

// ─── Shared Arbitraries ───────────────────────────────────────────────────────

// Use integer-based timestamps to avoid Invalid Date issues during shrinking.
// Range: 2000-01-01 to 2100-01-01 in milliseconds.
const MIN_TS = new Date('2000-01-01T00:00:00.000Z').getTime()
const MAX_TS = new Date('2100-01-01T00:00:00.000Z').getTime()

const safeDateIso: fc.Arbitrary<string> = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map((ms) => new Date(ms).toISOString())

const safeDateObj: fc.Arbitrary<Date> = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map((ms) => new Date(ms))

const attendanceStatusArb = fc.constantFrom(
  'NOT_JOINED',
  'IN_PROGRESS',
  'COMPLETED'
) as fc.Arbitrary<AttendanceStatus>

const attendanceRecordArb: fc.Arbitrary<AttendanceRecord> = fc.record({
  internId: fc.uuid(),
  internName: fc.string({ minLength: 1, maxLength: 50 }),
  internEmail: fc.emailAddress(),
  status: attendanceStatusArb,
  joinedAt: fc.option(safeDateIso, { nil: null }),
  startedAt: fc.option(safeDateIso, { nil: null }),
  attemptStatus: fc.option(
    fc.constantFrom('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT', 'TERMINATED'),
    { nil: null }
  ),
  violations: fc.integer({ min: 0, max: 100 }),
})

// ─── Sort helper (mirrors the SQL ORDER BY) ───────────────────────────────────

function sortInterns(interns: AttendanceRecord[]): AttendanceRecord[] {
  const priority: Record<AttendanceStatus, number> = {
    IN_PROGRESS: 1,
    NOT_JOINED: 2,
    COMPLETED: 3,
  }
  return [...interns].sort((a, b) => {
    const pd = priority[a.status] - priority[b.status]
    if (pd !== 0) return pd
    return a.internName.localeCompare(b.internName)
  })
}

// ─── Filter helper (mirrors the client-side filter logic) ────────────────────

function filterInterns(
  interns: AttendanceRecord[],
  filter: 'ALL' | AttendanceStatus
): AttendanceRecord[] {
  if (filter === 'ALL') return interns
  return interns.filter((i) => i.status === filter)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('attendance utility functions — property-based tests', () => {
  // ── Property 1 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 1: classifyIntern always returns one of three valid statuses
    'Property 1: classifyIntern always returns one of three valid statuses for any input combination',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            joinedAt: fc.option(safeDateIso, { nil: null }),
            attemptStatus: fc.option(
              fc.constantFrom(
                'IN_PROGRESS',
                'SUBMITTED',
                'TIMED_OUT',
                'TERMINATED'
              ),
              { nil: null }
            ),
          }),
          (row) => {
            const status = classifyIntern(row)
            return ['NOT_JOINED', 'IN_PROGRESS', 'COMPLETED'].includes(status)
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  // ── Property 3 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 3: sorted intern list always satisfies the status-priority + alphabetical ordering invariant
    'Property 3: sorted intern list always satisfies the status-priority + alphabetical ordering invariant',
    () => {
      fc.assert(
        fc.property(fc.array(attendanceRecordArb, { maxLength: 50 }), (interns) => {
          const sorted = sortInterns(interns)

          const priority: Record<AttendanceStatus, number> = {
            IN_PROGRESS: 1,
            NOT_JOINED: 2,
            COMPLETED: 3,
          }

          for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i]
            const b = sorted[i + 1]
            const pa = priority[a.status]
            const pb = priority[b.status]

            // Status priority must be non-decreasing
            if (pa > pb) return false

            // Within the same status group, names must be alphabetically non-decreasing
            if (pa === pb) {
              if (a.internName.localeCompare(b.internName) > 0) return false
            }
          }

          return true
        }),
        { numRuns: 100 }
      )
    }
  )

  // ── Property 4 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 4: computeSummary counts are always consistent with the input array
    'Property 4: computeSummary counts are always consistent with the input array',
    () => {
      fc.assert(
        fc.property(fc.array(attendanceRecordArb, { maxLength: 100 }), (interns) => {
          const summary = computeSummary(interns)

          const expectedTotal = interns.length
          const expectedNotJoined = interns.filter(
            (i) => i.status === 'NOT_JOINED'
          ).length
          const expectedInProgress = interns.filter(
            (i) => i.status === 'IN_PROGRESS'
          ).length
          const expectedCompleted = interns.filter(
            (i) => i.status === 'COMPLETED'
          ).length
          const expectedJoined = expectedInProgress + expectedCompleted

          return (
            summary.total === expectedTotal &&
            summary.notJoined === expectedNotJoined &&
            summary.inProgress === expectedInProgress &&
            summary.completed === expectedCompleted &&
            summary.joined === expectedJoined
          )
        }),
        { numRuns: 100 }
      )
    }
  )

  // ── Property 5 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 5: joinRate always equals Math.round((joined / total) * 100) for any valid (joined, total) pair
    'Property 5: joinRate always equals Math.round((joined / total) * 100) for any valid (joined, total) pair',
    () => {
      // Non-empty arrays: joinRate === Math.round((joined / total) * 100)
      fc.assert(
        fc.property(
          fc.array(attendanceRecordArb, { minLength: 1, maxLength: 100 }),
          (interns) => {
            const summary = computeSummary(interns)
            const expectedJoinRate = Math.round(
              (summary.joined / summary.total) * 100
            )
            return summary.joinRate === expectedJoinRate
          }
        ),
        { numRuns: 100 }
      )

      // Empty array → joinRate must be 0
      const emptySummary = computeSummary([])
      if (emptySummary.joinRate !== 0) {
        throw new Error(
          `Expected joinRate 0 for empty array, got ${emptySummary.joinRate}`
        )
      }
    }
  )

  // ── Property 6 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 6: formatElapsed always returns a non-negative duration string for any past timestamp
    'Property 6: formatElapsed always returns a non-negative duration string for any past timestamp',
    () => {
      fc.assert(
        fc.property(
          // Generate a past timestamp: between 1 second ago and 10 years ago
          fc.integer({ min: 1, max: 10 * 365 * 24 * 3600 }).map((secondsAgo) => {
            return new Date(Date.now() - secondsAgo * 1000).toISOString()
          }),
          (pastTimestamp) => {
            const result = formatElapsed(pastTimestamp)

            // Must match "Xm Ys" pattern
            const match = result.match(/^(\d+)m (\d+)s$/)
            if (!match) return false

            const minutes = parseInt(match[1], 10)
            const seconds = parseInt(match[2], 10)

            // Both must be non-negative
            return minutes >= 0 && seconds >= 0
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  // ── Property 7 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 7: filter function returns only records matching the filter value for any input array
    'Property 7: filter function returns only records matching the filter value for any input array',
    () => {
      // Specific status filters return only matching records
      fc.assert(
        fc.property(
          fc.array(attendanceRecordArb, { maxLength: 100 }),
          fc.constantFrom(
            'IN_PROGRESS',
            'NOT_JOINED',
            'COMPLETED'
          ) as fc.Arbitrary<AttendanceStatus>,
          (interns, filterValue) => {
            const filtered = filterInterns(interns, filterValue)

            // Every record in the result must match the filter
            const allMatch = filtered.every((r) => r.status === filterValue)

            // The count must equal the number of matching records in the input
            const expectedCount = interns.filter(
              (r) => r.status === filterValue
            ).length
            const countMatches = filtered.length === expectedCount

            return allMatch && countMatches
          }
        ),
        { numRuns: 100 }
      )

      // ALL filter returns all records unchanged (same length)
      fc.assert(
        fc.property(
          fc.array(attendanceRecordArb, { maxLength: 100 }),
          (interns) => {
            const filtered = filterInterns(interns, 'ALL')
            return filtered.length === interns.length
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  // ── Property 8 ──────────────────────────────────────────────────────────────
  it(
    // Feature: attendance-view, Property 8: getWindowStatus returns the correct status for all (startAt, endAt, now) combinations including null cases
    'Property 8: getWindowStatus returns the correct status for all (startAt, endAt, now) combinations including null cases',
    () => {
      // Case A: null startAt or endAt → NO_WINDOW_SET
      fc.assert(
        fc.property(
          fc.oneof(
            // startAt is null, endAt may be anything
            fc.record({
              startAt: fc.constant(null) as fc.Arbitrary<null>,
              endAt: fc.option(safeDateIso, { nil: null }),
              now: safeDateObj,
            }),
            // endAt is null, startAt may be anything
            fc.record({
              startAt: fc.option(safeDateIso, { nil: null }),
              endAt: fc.constant(null) as fc.Arbitrary<null>,
              now: safeDateObj,
            })
          ),
          ({ startAt, endAt, now }) => {
            return getWindowStatus(startAt, endAt, now) === 'NO_WINDOW_SET'
          }
        ),
        { numRuns: 100 }
      )

      // Case B: both non-null — verify UPCOMING / OPEN / CLOSED
      // Generate three timestamps as integers and sort them to get start ≤ mid ≤ end
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: MIN_TS, max: MAX_TS }),
              fc.integer({ min: MIN_TS, max: MAX_TS }),
              fc.integer({ min: MIN_TS, max: MAX_TS })
            )
            .map(([t1, t2, t3]) => {
              const sorted = [t1, t2, t3].sort((a, b) => a - b)
              return {
                startMs: sorted[0],
                midMs: sorted[1],
                endMs: sorted[2],
              }
            }),
          ({ startMs, midMs, endMs }) => {
            const startAt = new Date(startMs).toISOString()
            const endAt = new Date(endMs).toISOString()
            const startDate = new Date(startMs)
            const midDate = new Date(midMs)
            const endDate = new Date(endMs)

            // UPCOMING: now is strictly before start
            if (startMs > MIN_TS) {
              const beforeStart = new Date(startMs - 1)
              const upcomingResult = getWindowStatus(startAt, endAt, beforeStart)
              if (upcomingResult !== 'UPCOMING') return false
            }

            // CLOSED: now is strictly after end
            if (endMs < MAX_TS) {
              const afterEnd = new Date(endMs + 1)
              const closedResult = getWindowStatus(startAt, endAt, afterEnd)
              if (closedResult !== 'CLOSED') return false
            }

            // OPEN: now is the mid date (start ≤ mid ≤ end)
            const openResult = getWindowStatus(startAt, endAt, midDate)
            if (openResult !== 'OPEN') return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})
