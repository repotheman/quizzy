import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { ExamShell } from "@/components/exam/ExamShell"
import { finalizeAttempt } from "@/lib/attempts"

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>
  searchParams: Promise<{ attemptId?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "INTERN") {
    redirect("/login")
  }

  const { quizId } = await params
  const { attemptId } = await searchParams

  if (!attemptId) redirect(`/intern/quizzes/${quizId}`)

  // Load attempt + quiz + DB-side elapsed in one query
  const [row] = await sql`
    SELECT
      qa.id                                                          AS "attemptId",
      qa."quizId",
      qa.status,
      qa.violations,
      q.title                                                        AS "quizTitle",
      q."timeLimitMinutes",
      q."maxViolations",
      EXTRACT(EPOCH FROM (NOW() - qa."startedAt"))::int              AS elapsed_seconds,
      (q."timeLimitMinutes" * 60)
        - EXTRACT(EPOCH FROM (NOW() - qa."startedAt"))::int          AS remaining_seconds
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa.id = ${attemptId}
    AND qa."internId" = ${session.user.id}
  `

  if (!row) redirect(`/intern/quizzes/${quizId}`)
  if (row.status !== "IN_PROGRESS") redirect("/intern/history")

  // Timer is purely based on timeLimitMinutes from when the intern started.
  // endAt is only a join window gate — once you're in, you get the full time.
  const initialSeconds = Math.max(0, Number(row.remaining_seconds))

  // Already expired — finalize and redirect
  if (initialSeconds <= 0) {
    await finalizeAttempt({ attemptId, internId: session.user.id, autoSubmit: true, reason: "TIMED_OUT" })
    redirect("/intern/history")
  }

  // Load questions + options
  const questions = await sql`
    SELECT id, text, type, points, "order"
    FROM questions
    WHERE "quizId" = ${row.quizId}
    ORDER BY "order" ASC
  ` as { id: string; text: string; type: "MCQ" | "TRUE_FALSE"; points: number; order: number }[]

  const questionIds = questions.map(q => q.id)
  const options = questionIds.length > 0
    ? await sql`
        SELECT id, "questionId", text, "order"
        FROM options
        WHERE "questionId" = ANY(${questionIds})
        ORDER BY "order" ASC
      ` as { id: string; questionId: string; text: string; order: number }[]
    : []

  const answerRows = await sql`
    SELECT "questionId", "selectedOptionId"
    FROM answers
    WHERE "attemptId" = ${attemptId}
  ` as { questionId: string; selectedOptionId: string | null }[]

  const existingAnswers: Record<string, string> = {}
  for (const a of answerRows) {
    if (a.selectedOptionId) existingAnswers[a.questionId] = a.selectedOptionId
  }

  const questionsWithOptions = questions.map(q => ({
    id: q.id,
    text: q.text,
    type: q.type,
    points: q.points,
    options: options
      .filter(o => o.questionId === q.id)
      .map(o => ({ id: o.id, text: o.text })),
  }))

  return (
    <ExamShell
      attemptId={attemptId}
      quizTitle={row.quizTitle}
      timeLimitMinutes={Number(row.timeLimitMinutes)}
      initialSeconds={initialSeconds}
      maxViolations={Number(row.maxViolations)}
      initialViolations={Number(row.violations) || 0}
      questions={questionsWithOptions}
      existingAnswers={existingAnswers}
    />
  )
}
