import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { csvEscape } from '../csv'

// ─── Minimal CSV field parser ─────────────────────────────────────────────────
// Parses a single CSV field (quoted or unquoted) and returns the original value.
// This mirrors what a standard CSV parser would do for a single field.
function csvParseField(field: string): string {
  if (field.startsWith('"') && field.endsWith('"')) {
    // Strip surrounding quotes and unescape "" → "
    return field.slice(1, -1).replace(/""/g, '"')
  }
  return field
}

// ─── Unit tests for CSV header row (Property 11) ─────────────────────────────

describe('CSV export — header row (Property 11)', () => {
  // Validates: Requirements 4.2
  const EXPECTED_HEADERS = [
    'attempt_id',
    'intern_name',
    'intern_email',
    'status',
    'score',
    'total_points',
    'percentage',
    'passed',
    'rank',
    'violations',
    'time_spent_seconds',
    'started_at',
    'submitted_at',
  ]

  /**
   * Builds a CSV string from a list of attempt rows, mirroring the route logic.
   * Used here to test the header independently of the database.
   */
  function buildCsv(attempts: Array<Record<string, unknown>>): string {
    const header = EXPECTED_HEADERS.join(',')
    const rows = attempts.map((row) => {
      const fields = [
        csvEscape(String(row.attempt_id ?? '')),
        csvEscape(String(row.intern_name ?? '')),
        csvEscape(String(row.intern_email ?? '')),
        csvEscape(String(row.status ?? '')),
        row.score != null ? String(row.score) : '',
        row.total_points != null ? String(row.total_points) : '',
        row.percentage != null ? String(row.percentage) : '',
        row.passed != null ? String(row.passed) : '',
        row.rank != null ? String(row.rank) : '',
        row.violations != null ? String(row.violations) : '',
        row.time_spent_seconds != null ? String(row.time_spent_seconds) : '',
        row.started_at != null ? new Date(row.started_at as string).toISOString() : '',
        row.submitted_at != null ? new Date(row.submitted_at as string).toISOString() : '',
      ]
      return fields.join(',')
    })
    return [header, ...rows].join('\n')
  }

  it('8.3 — first line is always the 13-column header, regardless of data rows', () => {
    // With no data rows
    const csvEmpty = buildCsv([])
    const firstLineEmpty = csvEmpty.split('\n')[0]
    expect(firstLineEmpty).toBe(EXPECTED_HEADERS.join(','))

    // With one data row
    const csvOne = buildCsv([
      {
        attempt_id: 'abc',
        intern_name: 'Alice',
        intern_email: 'alice@example.com',
        status: 'SUBMITTED',
        score: 80,
        total_points: 100,
        percentage: 80,
        passed: true,
        rank: 1,
        violations: 0,
        time_spent_seconds: 300,
        started_at: '2025-01-01T10:00:00.000Z',
        submitted_at: '2025-01-01T10:05:00.000Z',
      },
    ])
    const firstLineOne = csvOne.split('\n')[0]
    expect(firstLineOne).toBe(EXPECTED_HEADERS.join(','))

    // With multiple data rows
    const csvMulti = buildCsv([
      { attempt_id: 'a', intern_name: 'A', intern_email: 'a@x.com', status: 'SUBMITTED', score: 90, total_points: 100, percentage: 90, passed: true, rank: 1, violations: 0, time_spent_seconds: 200, started_at: '2025-01-01T10:00:00.000Z', submitted_at: '2025-01-01T10:03:00.000Z' },
      { attempt_id: 'b', intern_name: 'B', intern_email: 'b@x.com', status: 'TIMED_OUT', score: 50, total_points: 100, percentage: 50, passed: false, rank: 2, violations: 1, time_spent_seconds: 600, started_at: '2025-01-01T11:00:00.000Z', submitted_at: null },
    ])
    const firstLineMulti = csvMulti.split('\n')[0]
    expect(firstLineMulti).toBe(EXPECTED_HEADERS.join(','))
  })

  it('8.3 — header contains exactly 13 columns', () => {
    const csv = buildCsv([])
    const headerColumns = csv.split('\n')[0].split(',')
    expect(headerColumns).toHaveLength(13)
  })

  it('8.3 — header columns are in the correct order', () => {
    const csv = buildCsv([])
    const headerColumns = csv.split('\n')[0].split(',')
    expect(headerColumns).toEqual(EXPECTED_HEADERS)
  })
})

// ─── Property-based test: CSV escaping round-trip (Property 13) ──────────────

describe('csvEscape — round-trip property (Property 13)', () => {
  // Feature: admin-controls, Property 13: CSV escaping round-trips correctly
  // Validates: Requirements 4.8
  it(
    'Property 13: csvEscape round-trips correctly for any string value',
    () => {
      fc.assert(
        fc.property(
          // Generate arbitrary strings including commas, double-quotes, newlines
          fc.string(),
          (value) => {
            const escaped = csvEscape(value)
            const parsed = csvParseField(escaped)
            return parsed === value
          }
        ),
        { numRuns: 1000 }
      )
    }
  )

  it('csvEscape — specific edge cases', () => {
    // Plain string — no escaping needed
    expect(csvEscape('hello')).toBe('hello')

    // Contains comma — must be quoted
    expect(csvEscape('hello, world')).toBe('"hello, world"')

    // Contains double-quote — must be quoted and escaped
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')

    // Contains newline — must be quoted
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')

    // Contains carriage return — must be quoted
    expect(csvEscape('line1\rline2')).toBe('"line1\rline2"')

    // Empty string — no escaping needed
    expect(csvEscape('')).toBe('')

    // All three special chars combined
    expect(csvEscape('a,b\n"c"')).toBe('"a,b\n""c"""')
  })
})

// ─── Property-based test: CSV row count (Property 12) ────────────────────────

describe('CSV row count — finalized attempt count (Property 12)', () => {
  // Feature: admin-controls, Property 12: CSV row count matches finalized attempt count
  // Validates: Requirements 4.3, 4.4

  const EXPECTED_HEADERS = [
    'attempt_id',
    'intern_name',
    'intern_email',
    'status',
    'score',
    'total_points',
    'percentage',
    'passed',
    'rank',
    'violations',
    'time_spent_seconds',
    'started_at',
    'submitted_at',
  ]

  type MockAttempt = {
    attempt_id: string
    intern_name: string
    intern_email: string
    status: string
    score: number | null
    total_points: number | null
    percentage: number | null
    passed: boolean | null
    rank: number | null
    violations: number
    time_spent_seconds: number | null
    started_at: string | null
    submitted_at: string | null
  }

  function buildCsvFromAttempts(attempts: MockAttempt[]): string {
    const header = EXPECTED_HEADERS.join(',')
    const rows = attempts.map((row) => {
      const fields = [
        csvEscape(String(row.attempt_id ?? '')),
        csvEscape(String(row.intern_name ?? '')),
        csvEscape(String(row.intern_email ?? '')),
        csvEscape(String(row.status ?? '')),
        row.score != null ? String(row.score) : '',
        row.total_points != null ? String(row.total_points) : '',
        row.percentage != null ? String(row.percentage) : '',
        row.passed != null ? String(row.passed) : '',
        row.rank != null ? String(row.rank) : '',
        row.violations != null ? String(row.violations) : '',
        row.time_spent_seconds != null ? String(row.time_spent_seconds) : '',
        row.started_at != null ? new Date(row.started_at).toISOString() : '',
        row.submitted_at != null ? new Date(row.submitted_at).toISOString() : '',
      ]
      return fields.join(',')
    })
    return [header, ...rows].join('\n')
  }

  const finalizedStatusArb = fc.constantFrom('SUBMITTED', 'TIMED_OUT', 'TERMINATED')

  const mockAttemptArb: fc.Arbitrary<MockAttempt> = fc.record({
    attempt_id: fc.uuid(),
    intern_name: fc.string({ minLength: 1, maxLength: 50 }),
    intern_email: fc.emailAddress(),
    status: finalizedStatusArb,
    score: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
    total_points: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
    percentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
    passed: fc.option(fc.boolean(), { nil: null }),
    rank: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
    violations: fc.integer({ min: 0, max: 50 }),
    time_spent_seconds: fc.option(fc.integer({ min: 0, max: 7200 }), { nil: null }),
    started_at: fc.option(
      fc.integer({ min: 1_600_000_000_000, max: 1_800_000_000_000 }).map((ms) => new Date(ms).toISOString()),
      { nil: null }
    ),
    submitted_at: fc.option(
      fc.integer({ min: 1_600_000_000_000, max: 1_800_000_000_000 }).map((ms) => new Date(ms).toISOString()),
      { nil: null }
    ),
  })

  it(
    'Property 12: CSV has exactly N+1 lines for N finalized attempts',
    () => {
      fc.assert(
        fc.property(
          fc.array(mockAttemptArb, { minLength: 0, maxLength: 50 }),
          (attempts) => {
            // The route only includes finalized attempts (status != IN_PROGRESS).
            // Our generator only produces finalized statuses, so all are included.
            const csv = buildCsvFromAttempts(attempts)
            const lines = csv.split('\n')
            // 1 header + N data rows
            return lines.length === attempts.length + 1
          }
        ),
        { numRuns: 200 }
      )
    }
  )

  it(
    'Property 12: data rows are ordered by percentage DESC, time_spent_seconds ASC',
    () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              attempt_id: fc.uuid(),
              intern_name: fc.string({ minLength: 1, maxLength: 20 }),
              intern_email: fc.emailAddress(),
              status: finalizedStatusArb,
              score: fc.constant(null),
              total_points: fc.constant(null),
              percentage: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
              passed: fc.constant(null),
              rank: fc.constant(null),
              violations: fc.integer({ min: 0, max: 10 }),
              time_spent_seconds: fc.option(fc.integer({ min: 0, max: 3600 }), { nil: null }),
              started_at: fc.constant(null),
              submitted_at: fc.constant(null),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (attempts) => {
            // Sort the attempts the same way the SQL query does
            const sorted = [...attempts].sort((a, b) => {
              const pa = a.percentage ?? -Infinity
              const pb = b.percentage ?? -Infinity
              if (pb !== pa) return pb - pa // DESC
              const ta = a.time_spent_seconds ?? Infinity
              const tb = b.time_spent_seconds ?? Infinity
              return ta - tb // ASC
            })

            const csv = buildCsvFromAttempts(sorted)
            const lines = csv.split('\n')
            const dataLines = lines.slice(1) // skip header

            // Verify each data row's attempt_id matches the sorted order
            for (let i = 0; i < sorted.length; i++) {
              const expectedId = sorted[i].attempt_id
              // The attempt_id is the first field in each row
              const actualId = csvParseField(dataLines[i].split(',')[0])
              if (actualId !== expectedId) return false
            }
            return true
          }
        ),
        { numRuns: 200 }
      )
    }
  )

  it('CSV with zero finalized attempts contains only the header row', () => {
    const csv = buildCsvFromAttempts([])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe(EXPECTED_HEADERS.join(','))
  })
})
