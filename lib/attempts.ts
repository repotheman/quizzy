import { sql } from "@/lib/db"

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinalizeReason = "SUBMITTED" | "TIMED_OUT" | "TERMINATED"

type FinalizeAttemptInput = {
  attemptId: string
  internId: string
  autoSubmit?: boolean
  reason?: FinalizeReason
}

export type FinalizeAttemptResult = {
  score: number
  totalPoints: number
  percentage: number
  passed: boolean
  status: string
  timeSpentSeconds: number
}

// ─── Core finalizer ───────────────────────────────────────────────────────────

/**
 * Finalizes a quiz attempt:
 * - Scores all answers in bulk (sets isCorrect on each answer row)
 * - Updates attempt with score, percentage, pass/fail, status, timeSpent
 * - Triggers auto-publish check (publishes results if all interns are done)
 *
 * Safe to call multiple times — returns existing result if already finalized.
 */
export async function finalizeAttempt({
  attemptId,
  internId,
  autoSubmit = false,
  reason,
}: FinalizeAttemptInput): Promise<FinalizeAttemptResult> {

  // Load attempt + quiz in one query, compute elapsed server-side
  const [attempt] = await sql`
    SELECT
      qa.id,
      qa."quizId",
      qa.status,
      qa."totalPoints",
      qa.score,
      qa.percentage,
      qa.passed,
      qa."timeSpentSeconds",
      q."timeLimitMinutes",
      q."passingScore",
      EXTRACT(EPOCH FROM (NOW() - qa."startedAt"))::int AS elapsed_seconds
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa.id        = ${attemptId}
    AND   qa."internId" = ${internId}
  `
  if (!attempt) throw new Error("Attempt not found")

  // Already finalized — return stored result immediately
  if (attempt.status !== "IN_PROGRESS") {
    return {
      score:            Number(attempt.score)            ?? 0,
      totalPoints:      Number(attempt.totalPoints)      ?? 0,
      percentage:       Number(attempt.percentage)       ?? 0,
      passed:           attempt.passed                   ?? false,
      status:           attempt.status,
      timeSpentSeconds: Number(attempt.timeSpentSeconds) ?? 0,
    }
  }

  // ── Determine final status ─────────────────────────────────────────────────
  const timeSpentSeconds = Number(attempt.elapsed_seconds)
  const timeLimitSeconds = Number(attempt.timeLimitMinutes) * 60

  let finalStatus: string = "SUBMITTED"
  if (reason === "TERMINATED") {
    finalStatus = "TERMINATED"
  } else if (timeSpentSeconds >= timeLimitSeconds) {
    finalStatus = "TIMED_OUT"
  }

  // ── Score answers in bulk ──────────────────────────────────────────────────
  // Mark each answer correct/incorrect by joining against the correct option
  await sql`
    UPDATE answers a
    SET
      "isCorrect" = (a."selectedOptionId" = o.id),
      "updatedAt" = NOW()
    FROM options o
    WHERE a."attemptId" = ${attemptId}
    AND   o."questionId" = a."questionId"
    AND   o."isCorrect"  = true
  `

  // Compute score from the now-updated answers
  const [scoring] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN a."isCorrect" THEN q.points ELSE 0 END), 0) AS score
    FROM answers a
    JOIN questions q ON q.id = a."questionId"
    WHERE a."attemptId" = ${attemptId}
  `

  const score       = Number(scoring.score)
  const totalPoints = Number(attempt.totalPoints) ?? 0
  const percentage  = totalPoints > 0
    ? Math.round((score / totalPoints) * 1000) / 10
    : 0
  const passed = percentage >= Number(attempt.passingScore)

  // ── Persist finalized attempt ──────────────────────────────────────────────
  await sql`
    UPDATE quiz_attempts SET
      status             = ${finalStatus},
      score              = ${score},
      percentage         = ${percentage},
      passed             = ${passed},
      "autoSubmitted"    = ${autoSubmit},
      "submittedAt"      = NOW(),
      "timeSpentSeconds" = ${timeSpentSeconds}
    WHERE id = ${attemptId}
  `

  // ── Auto-publish check ─────────────────────────────────────────────────────
  // If every assigned intern now has a finalized attempt, publish results
  await maybeAutoPublish(attempt.quizId as string)

  return { score, totalPoints, percentage, passed, status: finalStatus, timeSpentSeconds }
}

// ─── Auto-publish ─────────────────────────────────────────────────────────────

/**
 * Publishes quiz results automatically when every assigned intern
 * has a finalized attempt (any status except IN_PROGRESS).
 * Also computes and stores rank for each attempt.
 */
export async function maybeAutoPublish(quizId: string): Promise<void> {
  // Already published? Skip.
  const [quiz] = await sql`
    SELECT "resultsPublishedAt" FROM quizzes WHERE id = ${quizId}
  `
  if (!quiz || quiz.resultsPublishedAt !== null) return

  // Any assigned intern without a finalized attempt?
  const [{ pending }] = await sql`
    SELECT COUNT(*) AS pending
    FROM quiz_assignments qa
    LEFT JOIN quiz_attempts att
      ON  att."quizId"   = qa."quizId"
      AND att."internId" = qa."internId"
      AND att.status    != 'IN_PROGRESS'
    WHERE qa."quizId" = ${quizId}
    AND   att.id IS NULL
  `

  if (Number(pending) > 0) return  // still waiting on some interns

  // Everyone is done — publish and assign ranks
  await publishResults(quizId, null)
}

// ─── Manual / auto publish ────────────────────────────────────────────────────

/**
 * Publishes results for a quiz and assigns ranks.
 * @param publishedBy  admin userId for manual publish, null for auto-publish
 */
export async function publishResults(quizId: string, publishedBy: string | null): Promise<void> {
  // Rank by percentage DESC, timeSpentSeconds ASC (faster = better tiebreaker)
  await sql`
    UPDATE quiz_attempts att
    SET rank = ranked.rank
    FROM (
      SELECT
        id,
        RANK() OVER (
          ORDER BY percentage DESC NULLS LAST,
                   "timeSpentSeconds" ASC NULLS LAST
        ) AS rank
      FROM quiz_attempts
      WHERE "quizId" = ${quizId}
      AND   status  != 'IN_PROGRESS'
    ) ranked
    WHERE att.id = ranked.id
  `

  await sql`
    UPDATE quizzes SET
      "resultsPublishedAt" = NOW(),
      "resultsPublishedBy" = ${publishedBy}
    WHERE id = ${quizId}
    AND   "resultsPublishedAt" IS NULL
  `
}
