# Implementation Plan: Admin Controls

## Overview

Implement four administrative control capabilities (terminate attempt, override score, unpublish results, export CSV) plus a new `admin_audit_log` table. The implementation follows the existing Next.js App Router pattern: API routes in `app/api/admin/`, business logic in `lib/`, and client components that call the API and call `router.refresh()`.

## Tasks

- [x] 1. Create the `admin_audit_log` database table and `lib/audit.ts`
  - Add the `admin_audit_log` table migration SQL (id, adminId, action, targetType, targetId, metadata JSONB, createdAt) with indexes on `(targetType, targetId)` and `(adminId)`
  - Add `scoreOverriddenAt TIMESTAMPTZ` and `scoreOverriddenBy TEXT` columns to `quiz_attempts`
  - Create `lib/audit.ts` exporting `AuditAction` type, `AuditLogEntry` interface, and `writeAuditLog` function that inserts a row into `admin_audit_log`
  - Add `AdminAuditLog` interface to `lib/db.ts` type definitions
  - _Requirements: 5.1, 5.2_

  - [ ]* 1.1 Write unit tests for `writeAuditLog`
    - Mock the `sql` driver and assert the correct INSERT is called with all fields
    - Test that `createdAt` is set by the database default (not passed by the caller)
    - _Requirements: 5.1, 5.2_

- [x] 2. Implement `adminTerminateAttempt` in `lib/attempts.ts`
  - Add `adminTerminateAttempt(attemptId, adminId, reason?)` that loads the attempt, returns a 409-style error if status is not `IN_PROGRESS`, calls `finalizeAttempt` with `reason="TERMINATED"`, then calls `writeAuditLog` with action `"ADMIN_TERMINATED"` and metadata `{ reason: reason ?? null }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.1 Write property test for termination rejection (Property 1)
    - **Property 1: Termination rejects non-IN_PROGRESS attempts**
    - Generator: `fc.constantFrom("SUBMITTED", "TIMED_OUT", "TERMINATED")` for status
    - Assert: `adminTerminateAttempt` throws/rejects with a 409-style error for any non-IN_PROGRESS status, and the attempt row is not mutated
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 2.2 Write property test for termination reason preservation (Property 4)
    - **Property 4: Termination reason is preserved in audit log**
    - Generator: `fc.option(fc.string(), { nil: null })` for reason
    - Assert: the audit log entry's `metadata.reason` equals the passed reason exactly (including null)
    - **Validates: Requirements 1.4, 5.4**

  - [ ]* 2.3 Write unit test for `adminTerminateAttempt` happy path
    - Mock `finalizeAttempt` and `writeAuditLog`; verify `finalizeAttempt` is called with `reason="TERMINATED"` and `writeAuditLog` is called with `action="ADMIN_TERMINATED"`
    - _Requirements: 1.2, 1.3_

- [x] 3. Create `POST /api/admin/attempts/[attemptId]/terminate` route
  - Create `app/api/admin/attempts/[attemptId]/terminate/route.ts`
  - Auth guard: return 401 if no session or `role !== 'ADMIN'`
  - Parse optional `reason` string from request body
  - Call `adminTerminateAttempt`; map errors to 404 (not found) or 409 (already finalized)
  - Return 200 with the `FinalizeAttemptResult` on success
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.8_

- [x] 4. Implement `overrideScore` in `lib/attempts.ts`
  - Add `overrideScore(attemptId, adminId, scoreOverride)` that:
    - Loads the attempt with its quiz's `passingScore` and `totalPoints`
    - Returns a 404-style error if not found
    - Returns a 409-style error if `status === 'IN_PROGRESS'`
    - Returns a 422-style error if `scoreOverride < 0` or `scoreOverride > totalPoints`
    - Recomputes `percentage = Math.round((scoreOverride / totalPoints) * 1000) / 10` and `passed = percentage >= passingScore`
    - Updates `score`, `percentage`, `passed`, `scoreOverriddenAt = NOW()`, `scoreOverriddenBy = adminId` in a transaction
    - If the quiz has `resultsPublishedAt IS NOT NULL`, re-runs the rank UPDATE from `publishResults`
    - Calls `writeAuditLog` with action `"SCORE_OVERRIDE"` and metadata `{ previousScore, newScore: scoreOverride }`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 4.1 Write property test for score override percentage formula (Property 5)
    - **Property 5: Score override percentage formula is correct**
    - Generator: `fc.tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 100 }))` producing `[totalPoints, passingScore]`, then `fc.integer({ min: 0, max: totalPoints })` for `scoreOverride`
    - Assert: `percentage === Math.round((scoreOverride / totalPoints) * 1000) / 10` and `passed === (percentage >= passingScore)`
    - **Validates: Requirements 2.2**

  - [ ]* 4.2 Write property test for score override out-of-range rejection (Property 8)
    - **Property 8: Score override rejects out-of-range values**
    - Generator: `fc.integer({ max: -1 })` for negative values; `fc.tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0 })).map(([tp, extra]) => tp + extra + 1)` for values exceeding totalPoints
    - Assert: validation rejects with a 422-style error for both cases
    - **Validates: Requirements 2.1, 2.6**

- [x] 5. Create `PATCH /api/admin/attempts/[attemptId]/score` route
  - Create `app/api/admin/attempts/[attemptId]/score/route.ts`
  - Auth guard: return 401 if no session or `role !== 'ADMIN'`
  - Parse and validate `scoreOverride` (must be a number) from request body; return 400 if missing or not a number
  - Call `overrideScore`; map errors to 404, 409, 422 as appropriate
  - Return 200 with `{ score, percentage, passed }` on success
  - _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9_

- [x] 6. Implement `unpublishResults` in `lib/attempts.ts`
  - Add `unpublishResults(quizId, adminId)` that:
    - Loads the quiz; returns a 404-style error if not found
    - Returns a 409-style error if `resultsPublishedAt IS NULL`
    - In a transaction: sets `resultsPublishedAt = NULL`, `resultsPublishedBy = NULL` on the quiz, and sets `rank = NULL` on all finalized attempts for that quiz
    - Calls `writeAuditLog` with action `"RESULTS_UNPUBLISHED"` and metadata `{ previousPublishedAt: quiz.resultsPublishedAt.toISOString() }`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 6.1 Write property test for unpublish clearing fields (Property 9)
    - **Property 9: Unpublish clears publication fields and all ranks**
    - Generator: mock quiz with arbitrary `resultsPublishedAt` (non-null) and N finalized attempts with arbitrary ranks
    - Assert: after `unpublishResults`, quiz has `resultsPublishedAt = NULL` and `resultsPublishedBy = NULL`, and every attempt has `rank = NULL`
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 6.2 Write property test for unpublish rejection (Property 10)
    - **Property 10: Unpublish rejects already-unpublished quizzes**
    - Generator: mock quiz with `resultsPublishedAt = null`
    - Assert: `unpublishResults` throws/rejects with a 409-style error and the quiz row is unchanged
    - **Validates: Requirements 3.1, 3.5**

- [x] 7. Create `POST /api/admin/quizzes/[quizId]/unpublish` route
  - Create `app/api/admin/quizzes/[quizId]/unpublish/route.ts`
  - Auth guard: return 401 if no session or `role !== 'ADMIN'`
  - Call `unpublishResults`; map errors to 404 and 409
  - Return 200 `{ success: true }` on success
  - _Requirements: 3.1, 3.5, 3.6, 3.9_

- [x] 8. Implement CSV export utility and route
  - Create `lib/csv.ts` with a `csvEscape(value: string): string` function that wraps values containing commas, double-quotes, or newlines in double-quotes and escapes internal double-quotes as `""`
  - Create `app/api/admin/quizzes/[quizId]/export/route.ts` as a `GET` handler that:
    - Auth guards (401 for non-admin)
    - Queries the quiz title; returns 404 if not found
    - Queries all finalized attempts with intern name/email, ordered by `percentage DESC, time_spent_seconds ASC`
    - Builds the CSV string with the 13-column header row and one data row per finalized attempt
    - Returns a `Response` with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="results-{slug}-{YYYY-MM-DD}.csv"`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8_

  - [ ]* 8.1 Write property test for CSV escaping round-trip (Property 13)
    - **Property 13: CSV escaping round-trips correctly**
    - Generator: `fc.string()` (arbitrary strings including commas, quotes, newlines)
    - Assert: a standard CSV parse of `csvEscape(value)` produces the original value
    - **Validates: Requirements 4.8**

  - [ ]* 8.2 Write property test for CSV row count (Property 12)
    - **Property 12: CSV row count matches finalized attempt count**
    - Generator: array of mock attempt objects with varying statuses (mix of IN_PROGRESS and finalized)
    - Assert: the generated CSV has exactly `finalized.length + 1` lines and data rows are ordered by `percentage DESC, time_spent_seconds ASC`
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 8.3 Write unit tests for CSV header row (Property 11)
    - Assert: the first line of the CSV always contains exactly the 13 specified column headers in the correct order, regardless of whether there are any data rows
    - **Validates: Requirements 4.2**

- [x] 9. Checkpoint — Ensure all tests pass
  - Run `pnpm test` and confirm all unit and property tests pass. Ask the user if any questions arise before continuing to UI work.

- [x] 10. Build `TerminateAttemptButton` client component
  - Create `app/admin/results/[attemptId]/terminate-button.tsx` as a `"use client"` component
  - Render a destructive `Button` that opens an `AlertDialog` for confirmation
  - Include an optional textarea for the admin to enter a termination reason
  - On confirm, `POST /api/admin/attempts/[attemptId]/terminate` with `{ reason }`
  - On success, show a `sonner` toast and call `router.refresh()`
  - On error, show an error toast
  - Only render the button when `attempt.status === 'IN_PROGRESS'`
  - _Requirements: 1.7, 1.8_

- [x] 11. Build `ScoreOverrideForm` client component
  - Create `app/admin/results/[attemptId]/score-override-form.tsx` as a `"use client"` component
  - Render a number `Input` (min=0, max=totalPoints) and a "Apply Override" `Button`
  - On submit, `PATCH /api/admin/attempts/[attemptId]/score` with `{ scoreOverride }`
  - On success, show a toast and call `router.refresh()`
  - On 422 error, display the validation message inline
  - Only render the form when `attempt.status !== 'IN_PROGRESS'`
  - _Requirements: 2.9, 2.10_

- [x] 12. Update attempt detail page to show admin controls and override indicator
  - Update `app/admin/results/[attemptId]/page.tsx` to:
    - Import and render `<TerminateAttemptButton>` when `attempt.status === 'IN_PROGRESS'`
    - Import and render `<ScoreOverrideForm>` when `attempt.status !== 'IN_PROGRESS'`
    - Display a "Manually adjusted" `Badge` (with an icon) when `attempt.scoreOverriddenAt` is non-null, showing the override timestamp
  - _Requirements: 1.7, 2.10_

- [x] 13. Build `UnpublishResultsButton` client component
  - Create `app/admin/leaderboard/unpublish-results-button.tsx` as a `"use client"` component following the same pattern as `PublishResultsButton`
  - Render a destructive `Button` that opens an `AlertDialog` warning that ranks will be cleared
  - On confirm, `POST /api/admin/quizzes/[quizId]/unpublish`
  - On success, show a toast and call `router.refresh()`
  - _Requirements: 3.7, 3.8_

- [x] 14. Build `ExportCsvButton` client component
  - Create `app/admin/leaderboard/export-csv-button.tsx` as a `"use client"` component
  - On click, fetch `GET /api/admin/quizzes/[quizId]/export`, convert the response to a Blob, create an object URL, and trigger a programmatic `<a>` click to download — without navigating away
  - Show a loading spinner while the download is in progress
  - Show an error toast if the request fails
  - _Requirements: 4.7_

- [x] 15. Wire admin controls into the leaderboard page
  - Update `app/admin/leaderboard/page.tsx` to:
    - Render `<UnpublishResultsButton>` when `quiz.resultsPublishedAt` is non-null (in place of or alongside the existing publish status indicator)
    - Render `<ExportCsvButton>` unconditionally so admins can export at any time
  - _Requirements: 3.7, 3.8, 4.7_

- [x] 16. Write property-based tests for cross-cutting properties
  - [ ]* 16.1 Write property test for audit log metadata structure (Property 15)
    - **Property 15: Audit log metadata structure is correct per action type**
    - Generator: random `previousScore`/`newScore` for SCORE_OVERRIDE; random `reason` (string or null) for ADMIN_TERMINATED; random ISO timestamp string for RESULTS_UNPUBLISHED
    - Assert: each metadata object contains exactly the required keys for its action type
    - **Validates: Requirements 5.3, 5.4, 5.5**

  - [ ]* 16.2 Write property test for audit log entry creation (Property 3)
    - **Property 3: Every admin action writes an audit log entry**
    - Generator: arbitrary `adminId`, `targetId`, `action` values
    - Assert: after each successful mutating operation, exactly one `admin_audit_log` row exists with the correct `adminId`, `targetId`, and `action`
    - **Validates: Requirements 1.3, 2.4, 3.4, 5.2**

  - [ ]* 16.3 Write property test for rank ordering invariant after score override (Property 7)
    - **Property 7: Score override on published quiz preserves rank ordering invariant**
    - Generator: array of 2–10 mock finalized attempts with arbitrary `percentage` and `timeSpentSeconds`; pick one to override with a new score
    - Assert: after the override, ranks are a contiguous sequence starting at 1 with no gaps or duplicates, and ordering is consistent with `percentage DESC, time_spent_seconds ASC`
    - **Validates: Requirements 2.5**

- [x] 17. Final checkpoint — Ensure all tests pass
  - Run `pnpm test` and confirm all tests pass. Verify the `admin_audit_log` table schema matches the design. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Properties 2, 6, and 14 are covered by integration tests rather than pure unit property tests, as they require real database state
- The `scoreOverriddenAt` / `scoreOverriddenBy` columns must be migrated before the score override route is deployed
- Audit log write failures are intentionally non-fatal (logged server-side only) per the design's deliberate tradeoff
