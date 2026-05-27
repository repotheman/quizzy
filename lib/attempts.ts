import { sql } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

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

// ─── Admin terminate ──────────────────────────────────────────────────────────

/**
 * Admin-terminates an in-progress attempt.
 * Loads the attempt, validates it is IN_PROGRESS, calls finalizeAttempt with
 * reason="TERMINATED", then writes an audit log entry.
 *
 * Throws { status: 404 } if the attempt does not exist.
 * Throws { status: 409 } if the attempt is already finalized.
 */
export async function adminTerminateAttempt(
  attemptId: string,
  adminId: string,
  reason?: string
): Promise<FinalizeAttemptResult> {
  // Load the attempt to check existence and status
  const [attempt] = await sql`
    SELECT id, "internId", status
    FROM quiz_attempts
    WHERE id = ${attemptId}
  `

  if (!attempt) {
    throw { status: 404, message: "Attempt not found" }
  }

  if (attempt.status !== "IN_PROGRESS") {
    throw { status: 409, message: "Attempt is already finalized" }
  }

  // Finalize with TERMINATED reason
  const result = await finalizeAttempt({
    attemptId,
    internId: attempt.internId as string,
    reason: "TERMINATED",
  })

  // Write audit log (non-fatal — errors are swallowed inside writeAuditLog)
  await writeAuditLog({
    adminId,
    action: "ADMIN_TERMINATED",
    targetType: "attempt",
    targetId: attemptId,
    metadata: { reason: reason ?? null },
  })

  return result
}

// ─── Score override ───────────────────────────────────────────────────────────

/**
 * Overrides the score of a finalized attempt.
 * Recomputes percentage and passed, updates rank if results are published.
 *
 * Throws { status: 404 } if the attempt does not exist.
 * Throws { status: 409 } if the attempt is IN_PROGRESS.
 * Throws { status: 422 } if scoreOverride is negative or exceeds totalPoints.
 */
export async function overrideScore(
  attemptId: string,
  adminId: string,
  scoreOverride: number
): Promise<{ score: number; percentage: number; passed: boolean }> {
  // Load attempt + quiz data in one query
  const [attempt] = await sql`
    SELECT
      qa.id,
      qa.status,
      qa.score                AS "previousScore",
      qa."quizId",
      qa."totalPoints",
      q."passingScore",
      q."resultsPublishedAt"
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa.id = ${attemptId}
  `

  if (!attempt) {
    throw { status: 404, message: "Attempt not found" }
  }

  if (attempt.status === "IN_PROGRESS") {
    throw { status: 409, message: "Cannot override score of an in-progress attempt" }
  }

  const totalPoints = Number(attempt.totalPoints) ?? 0

  if (scoreOverride < 0 || scoreOverride > totalPoints) {
    throw { status: 422, message: `scoreOverride must be between 0 and ${totalPoints}` }
  }

  const percentage = Math.round((scoreOverride / totalPoints) * 1000) / 10
  const passed = percentage >= Number(attempt.passingScore)
  const previousScore = Number(attempt.previousScore)

  // Update the attempt row
  await sql`
    UPDATE quiz_attempts SET
      score                = ${scoreOverride},
      percentage           = ${percentage},
      passed               = ${passed},
      "scoreOverriddenAt"  = NOW(),
      "scoreOverriddenBy"  = ${adminId}
    WHERE id = ${attemptId}
  `

  // If results are published, re-run rank computation for all finalized attempts
  if (attempt.resultsPublishedAt !== null) {
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
        WHERE "quizId" = ${attempt.quizId}
        AND   status  != 'IN_PROGRESS'
      ) ranked
      WHERE att.id = ranked.id
    `
  }

  // Write audit log (non-fatal)
  await writeAuditLog({
    adminId,
    action: "SCORE_OVERRIDE",
    targetType: "attempt",
    targetId: attemptId,
    metadata: { previousScore, newScore: scoreOverride },
  })

  return { score: scoreOverride, percentage, passed }
}

// ─── Unpublish results ────────────────────────────────────────────────────────

/**
 * Unpublishes results for a quiz.
 * Sets resultsPublishedAt/By to NULL and clears all ranks on finalized attempts.
 *
 * Throws { status: 404 } if the quiz does not exist.
 * Throws { status: 409 } if resultsPublishedAt is already NULL.
 */
export async function unpublishResults(
  quizId: string,
  adminId: string
): Promise<void> {
  // Load the quiz to check existence and publication state
  const [quiz] = await sql`
    SELECT id, "resultsPublishedAt"
    FROM quizzes
    WHERE id = ${quizId}
  `

  if (!quiz) {
    throw { status: 404, message: "Quiz not found" }
  }

  if (quiz.resultsPublishedAt === null) {
    throw { status: 409, message: "Results are not published" }
  }

  const previousPublishedAt = (quiz.resultsPublishedAt as Date).toISOString()

  // Clear publication fields on the quiz
  await sql`
    UPDATE quizzes SET
      "resultsPublishedAt" = NULL,
      "resultsPublishedBy" = NULL
    WHERE id = ${quizId}
  `

  // Clear ranks on all finalized attempts for this quiz
  await sql`
    UPDATE quiz_attempts SET
      rank = NULL
    WHERE "quizId" = ${quizId}
    AND   status  != 'IN_PROGRESS'
  `

  // Write audit log (non-fatal)
  await writeAuditLog({
    adminId,
    action: "RESULTS_UNPUBLISHED",
    targetType: "quiz",
    targetId: quizId,
    metadata: { previousPublishedAt },
  })
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
