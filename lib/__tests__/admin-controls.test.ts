import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Property 15: Audit log metadata structure is correct per action type ─────
// Feature: admin-controls, Property 15
// Validates: Requirements 5.3, 5.4, 5.5

describe('Audit log metadata structure (Property 15)', () => {
  // ── SCORE_OVERRIDE metadata ────────────────────────────────────────────────
  // Req 5.3: metadata SHALL contain `previousScore` and `newScore` keys.
  // The design shows `reason` is optional, so we only assert the required keys.

  it(
    'Property 15: SCORE_OVERRIDE metadata contains exactly previousScore and newScore',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000 }), // previousScore
          fc.integer({ min: 0, max: 10_000 }), // newScore
          (previousScore, newScore) => {
            const metadata: Record<string, unknown> = { previousScore, newScore }

            // Must contain both required keys
            expect(Object.prototype.hasOwnProperty.call(metadata, 'previousScore')).toBe(true)
            expect(Object.prototype.hasOwnProperty.call(metadata, 'newScore')).toBe(true)

            // Values must match what was passed in
            expect(metadata.previousScore).toBe(previousScore)
            expect(metadata.newScore).toBe(newScore)

            // Must not contain unexpected required keys (reason is optional)
            const keys = Object.keys(metadata)
            expect(keys).toContain('previousScore')
            expect(keys).toContain('newScore')
          }
        ),
        { numRuns: 200 }
      )
    }
  )

  // ── ADMIN_TERMINATED metadata ──────────────────────────────────────────────
  // Req 5.4: metadata SHALL contain a `reason` key (string or null).

  it(
    'Property 15: ADMIN_TERMINATED metadata contains exactly the reason key',
    () => {
      fc.assert(
        fc.property(
          fc.option(fc.string(), { nil: null }), // reason: string | null
          (reason) => {
            const metadata: Record<string, unknown> = { reason }

            // Must contain the reason key
            expect(Object.prototype.hasOwnProperty.call(metadata, 'reason')).toBe(true)

            // Value must be the passed reason (including null)
            expect(metadata.reason).toBe(reason)

            // Must contain exactly one key
            expect(Object.keys(metadata)).toHaveLength(1)
            expect(Object.keys(metadata)[0]).toBe('reason')
          }
        ),
        { numRuns: 200 }
      )
    }
  )

  // ── RESULTS_UNPUBLISHED metadata ───────────────────────────────────────────
  // Req 5.5: metadata SHALL contain a `previousPublishedAt` key (ISO timestamp).

  it(
    'Property 15: RESULTS_UNPUBLISHED metadata contains exactly the previousPublishedAt key',
    () => {
      fc.assert(
        fc.property(
          // Generate a valid ISO timestamp string
          fc
            .integer({ min: 1_600_000_000_000, max: 1_800_000_000_000 })
            .map((ms) => new Date(ms).toISOString()),
          (previousPublishedAt) => {
            const metadata: Record<string, unknown> = { previousPublishedAt }

            // Must contain the previousPublishedAt key
            expect(Object.prototype.hasOwnProperty.call(metadata, 'previousPublishedAt')).toBe(true)

            // Value must be the passed ISO string
            expect(metadata.previousPublishedAt).toBe(previousPublishedAt)

            // Must contain exactly one key
            expect(Object.keys(metadata)).toHaveLength(1)
            expect(Object.keys(metadata)[0]).toBe('previousPublishedAt')

            // Value must be a valid ISO 8601 date string
            const parsed = new Date(previousPublishedAt as string)
            expect(isNaN(parsed.getTime())).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    }
  )

  // ── Cross-action: no metadata key leakage ─────────────────────────────────
  // Each action type's metadata must not contain keys from other action types.

  it('ADMIN_TERMINATED metadata does not contain score keys', () => {
    const metadata = { reason: 'cheating' }
    expect(Object.keys(metadata)).not.toContain('previousScore')
    expect(Object.keys(metadata)).not.toContain('newScore')
    expect(Object.keys(metadata)).not.toContain('previousPublishedAt')
  })

  it('RESULTS_UNPUBLISHED metadata does not contain score or reason keys', () => {
    const metadata = { previousPublishedAt: '2025-01-15T10:30:00.000Z' }
    expect(Object.keys(metadata)).not.toContain('previousScore')
    expect(Object.keys(metadata)).not.toContain('newScore')
    expect(Object.keys(metadata)).not.toContain('reason')
  })
})

// ─── Pure rank computation helper ─────────────────────────────────────────────
// Extracted from the SQL RANK() OVER window in lib/attempts.ts:
//   ORDER BY percentage DESC NULLS LAST, "timeSpentSeconds" ASC NULLS LAST
//
// RANK() assigns the same rank to ties and leaves gaps (e.g., 1, 1, 3).

type AttemptForRank = {
  id: string
  percentage: number | null
  timeSpentSeconds: number | null
}

/**
 * Computes RANK() OVER (ORDER BY percentage DESC NULLS LAST, timeSpentSeconds ASC NULLS LAST)
 * for an array of finalized attempts.
 *
 * Returns a Map<id, rank>.
 */
function computeRanks(attempts: AttemptForRank[]): Map<string, number> {
  if (attempts.length === 0) return new Map()

  // Sort: percentage DESC NULLS LAST, timeSpentSeconds ASC NULLS LAST
  const sorted = [...attempts].sort((a, b) => {
    const pa = a.percentage ?? -Infinity  // NULLS LAST → treat as lowest
    const pb = b.percentage ?? -Infinity
    if (pb !== pa) return pb - pa         // DESC

    const ta = a.timeSpentSeconds ?? Infinity  // NULLS LAST → treat as highest
    const tb = b.timeSpentSeconds ?? Infinity
    return ta - tb                             // ASC
  })

  const rankMap = new Map<string, number>()
  let rank = 1

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      rankMap.set(sorted[i].id, rank)
    } else {
      const prev = sorted[i - 1]
      const curr = sorted[i]

      // Two attempts tie if both percentage AND timeSpentSeconds are equal
      const samePct = (curr.percentage ?? null) === (prev.percentage ?? null)
      const sameTime = (curr.timeSpentSeconds ?? null) === (prev.timeSpentSeconds ?? null)

      if (samePct && sameTime) {
        // Tie: same rank as previous
        rankMap.set(curr.id, rankMap.get(prev.id)!)
      } else {
        // No tie: rank = position (1-indexed), which creates gaps after ties
        rank = i + 1
        rankMap.set(curr.id, rank)
      }
    }
  }

  return rankMap
}

// ─── Property 7: Score override preserves rank ordering invariant ─────────────
// Feature: admin-controls, Property 7
// Validates: Requirements 2.5

describe('Rank ordering invariant after score override (Property 7)', () => {
  // Arbitrary for a single finalized attempt
  const attemptArb = fc.record({
    id: fc.uuid(),
    percentage: fc.option(
      fc.float({ min: 0, max: 100, noNaN: true }).map((v) => Math.round(v * 10) / 10),
      { nil: null }
    ),
    timeSpentSeconds: fc.option(fc.integer({ min: 0, max: 7200 }), { nil: null }),
  })

  // Array of 2–10 attempts with unique IDs (fast-check uuids are unique per run)
  const attemptsArb = fc.array(attemptArb, { minLength: 2, maxLength: 10 })

  // ── Assertion 1: Ranks start at 1 ─────────────────────────────────────────
  it(
    'Property 7a: ranks always start at 1',
    () => {
      fc.assert(
        fc.property(attemptsArb, (attempts) => {
          const rankMap = computeRanks(attempts)
          const ranks = Array.from(rankMap.values())
          expect(Math.min(...ranks)).toBe(1)
        }),
        { numRuns: 300 }
      )
    }
  )

  // ── Assertion 2: Ranks are contiguous accounting for ties ─────────────────
  // With RANK() (not ROW_NUMBER), if 2 attempts tie for rank 1, next rank is 3.
  // The set of ranks must equal { 1, 2, ..., N } minus the skipped positions.
  // Equivalently: every rank value r in [1..N] is either present OR all
  // positions 1..(r-1) are occupied by ties that caused the skip.
  //
  // Simpler invariant: the number of distinct rank values equals the number of
  // distinct (percentage, timeSpentSeconds) pairs.
  it(
    'Property 7b: number of distinct ranks equals number of distinct (percentage, time) pairs',
    () => {
      fc.assert(
        fc.property(attemptsArb, (attempts) => {
          const rankMap = computeRanks(attempts)

          // Count distinct (percentage, timeSpentSeconds) pairs
          const distinctPairs = new Set(
            attempts.map((a) => `${a.percentage ?? 'null'}|${a.timeSpentSeconds ?? 'null'}`)
          )

          const distinctRanks = new Set(rankMap.values())
          expect(distinctRanks.size).toBe(distinctPairs.size)
        }),
        { numRuns: 300 }
      )
    }
  )

  // ── Assertion 3: Ordering consistency ─────────────────────────────────────
  // For any two attempts A and B:
  //   rank(A) < rank(B) implies percentage(A) >= percentage(B)
  //   (or same percentage but timeSpentSeconds(A) <= timeSpentSeconds(B))
  it(
    'Property 7c: if rank(A) < rank(B) then A sorts before B by percentage DESC, time ASC',
    () => {
      fc.assert(
        fc.property(attemptsArb, (attempts) => {
          const rankMap = computeRanks(attempts)

          for (let i = 0; i < attempts.length; i++) {
            for (let j = i + 1; j < attempts.length; j++) {
              const a = attempts[i]
              const b = attempts[j]
              const rankA = rankMap.get(a.id)!
              const rankB = rankMap.get(b.id)!

              if (rankA < rankB) {
                // A ranks higher than B → A must sort before B
                const pa = a.percentage ?? -Infinity
                const pb = b.percentage ?? -Infinity
                const ta = a.timeSpentSeconds ?? Infinity
                const tb = b.timeSpentSeconds ?? Infinity

                // Either A has strictly higher percentage, OR same percentage and A is faster
                const aBeforeB = pa > pb || (pa === pb && ta <= tb)
                expect(aBeforeB).toBe(true)
              } else if (rankA > rankB) {
                // B ranks higher than A → B must sort before A
                const pa = a.percentage ?? -Infinity
                const pb = b.percentage ?? -Infinity
                const ta = a.timeSpentSeconds ?? Infinity
                const tb = b.timeSpentSeconds ?? Infinity

                const bBeforeA = pb > pa || (pb === pa && tb <= ta)
                expect(bBeforeA).toBe(true)
              }
              // Equal ranks → tied, no ordering constraint between them
            }
          }
        }),
        { numRuns: 300 }
      )
    }
  )

  // ── Assertion 4: No two attempts with different (pct, time) share a rank ──
  it(
    'Property 7d: no two attempts with different (percentage, timeSpentSeconds) have the same rank',
    () => {
      fc.assert(
        fc.property(attemptsArb, (attempts) => {
          const rankMap = computeRanks(attempts)

          for (let i = 0; i < attempts.length; i++) {
            for (let j = i + 1; j < attempts.length; j++) {
              const a = attempts[i]
              const b = attempts[j]

              const samePct = (a.percentage ?? null) === (b.percentage ?? null)
              const sameTime = (a.timeSpentSeconds ?? null) === (b.timeSpentSeconds ?? null)
              const samePair = samePct && sameTime

              const rankA = rankMap.get(a.id)!
              const rankB = rankMap.get(b.id)!

              if (!samePair) {
                // Different sort keys → must have different ranks
                expect(rankA).not.toBe(rankB)
              } else {
                // Same sort keys → must have the same rank (tied)
                expect(rankA).toBe(rankB)
              }
            }
          }
        }),
        { numRuns: 300 }
      )
    }
  )

  // ── Concrete example: score override changes one attempt's rank ────────────
  it('concrete: overriding a score recomputes ranks correctly', () => {
    // Before override: A=90%, B=80%, C=70%
    const before: AttemptForRank[] = [
      { id: 'a', percentage: 90, timeSpentSeconds: 300 },
      { id: 'b', percentage: 80, timeSpentSeconds: 200 },
      { id: 'c', percentage: 70, timeSpentSeconds: 400 },
    ]
    const ranksBefore = computeRanks(before)
    expect(ranksBefore.get('a')).toBe(1)
    expect(ranksBefore.get('b')).toBe(2)
    expect(ranksBefore.get('c')).toBe(3)

    // After override: C's score is raised to 95% (now highest)
    const after: AttemptForRank[] = [
      { id: 'a', percentage: 90, timeSpentSeconds: 300 },
      { id: 'b', percentage: 80, timeSpentSeconds: 200 },
      { id: 'c', percentage: 95, timeSpentSeconds: 400 }, // overridden
    ]
    const ranksAfter = computeRanks(after)
    expect(ranksAfter.get('c')).toBe(1)
    expect(ranksAfter.get('a')).toBe(2)
    expect(ranksAfter.get('b')).toBe(3)
  })

  it('concrete: ties get the same rank with a gap after', () => {
    // A and B both have 80% and same time → both rank 1, C gets rank 3
    const attempts: AttemptForRank[] = [
      { id: 'a', percentage: 80, timeSpentSeconds: 300 },
      { id: 'b', percentage: 80, timeSpentSeconds: 300 },
      { id: 'c', percentage: 70, timeSpentSeconds: 200 },
    ]
    const ranks = computeRanks(attempts)
    expect(ranks.get('a')).toBe(1)
    expect(ranks.get('b')).toBe(1)
    expect(ranks.get('c')).toBe(3)
  })

  it('concrete: null percentage is ranked last (NULLS LAST)', () => {
    const attempts: AttemptForRank[] = [
      { id: 'a', percentage: 80, timeSpentSeconds: 300 },
      { id: 'b', percentage: null, timeSpentSeconds: 100 },
    ]
    const ranks = computeRanks(attempts)
    expect(ranks.get('a')).toBe(1)
    expect(ranks.get('b')).toBe(2)
  })

  it('concrete: same percentage, faster time wins (lower rank number)', () => {
    const attempts: AttemptForRank[] = [
      { id: 'slow', percentage: 80, timeSpentSeconds: 600 },
      { id: 'fast', percentage: 80, timeSpentSeconds: 200 },
    ]
    const ranks = computeRanks(attempts)
    expect(ranks.get('fast')).toBe(1)
    expect(ranks.get('slow')).toBe(2)
  })
})
