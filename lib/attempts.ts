import { sql } from "@/lib/db"

type FinalizeAttemptInput = {
  attemptId: string
  internId: string
  autoSubmit?: boolean
  reason?: string
}

type FinalizeAttemptResult = {
  score: number
  totalPoints: number
  percentage: number
  passed: boolean
  status: string
  timeSpentSeconds: number
}

export async function finalizeAttempt({
  attemptId,
  internId,
  autoSubmit = false,
  reason,
}: FinalizeAttemptInput): Promise<FinalizeAttemptResult> {
  // Single query: attempt + quiz + DB-side elapsed + deadline check
  const [attempt] = await sql`
    SELECT
      qa.*,
      q."timeLimitMinutes",
      q."passingScore",
      EXTRACT(EPOCH FROM (NOW() - qa."startedAt"))::int          AS elapsed_seconds,
      asg."endAt" IS NOT NULL AND NOW() > asg."endAt"            AS deadline_passed
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    LEFT JOIN quiz_assignments asg
      ON asg."quizId" = qa."quizId" AND asg."internId" = qa."internId"
    WHERE qa.id = ${attemptId}
    AND qa."internId" = ${internId}
  `

  if (!attempt) throw new Error("Attempt not found")

  // Already finalized — return existing result
  if (attempt.status !== "IN_PROGRESS") {
    return {
      score:            Number(attempt.score)            || 0,
      totalPoints:      Number(attempt.totalPoints)      || 0,
      percentage:       Number(attempt.percentage)       || 0,
      passed:           attempt.passed                   || false,
      status:           attempt.status,
      timeSpentSeconds: Number(attempt.timeSpentSeconds) || 0,
    }
  }

  const timeSpentSeconds  = Number(attempt.elapsed_seconds)
  const timeLimitSeconds  = Number(attempt.timeLimitMinutes) * 60
  const deadlinePassed    = Boolean(attempt.deadline_passed)

  let status = "SUBMITTED"
  if (autoSubmit && reason === "TERMINATED") {
    status = "TERMINATED"
  } else if (timeSpentSeconds > timeLimitSeconds || deadlinePassed) {
    status = "TIMED_OUT"
  }

  // Score answers
  const answers = await sql`
    SELECT a."isCorrect", q.points
    FROM answers a
    JOIN questions q ON q.id = a."questionId"
    WHERE a."attemptId" = ${attemptId}
  ` as { isCorrect: boolean; points: number }[]

  const score       = answers.filter(a => a.isCorrect).reduce((s, a) => s + Number(a.points), 0)
  const totalPoints = Number(attempt.totalPoints) || 0
  const percentage  = totalPoints > 0 ? Math.round((score / totalPoints) * 1000) / 10 : 0
  const passed      = percentage >= Number(attempt.passingScore)

  await sql`
    UPDATE quiz_attempts SET
      status             = ${status},
      score              = ${score},
      percentage         = ${percentage},
      passed             = ${passed},
      "autoSubmitted"    = ${autoSubmit},
      "submittedAt"      = NOW(),
      "timeSpentSeconds" = ${timeSpentSeconds}
    WHERE id = ${attemptId}
  `

  return { score, totalPoints, percentage, passed, status, timeSpentSeconds }
}
