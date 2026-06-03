import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { ExamShell } from "@/components/exam/ExamShell"
import { finalizeAttempt } from "@/lib/attempts"

// ── Deterministic shuffle using attemptId as seed ─────────────────────────────
// Same intern resuming always gets the same order.
// Different interns (different attemptIds) get different orders.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  // Simple 32-bit xorshift seeded from the string
  let s = 0
  for (let i = 0; i < seed.length; i++) {
    s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0
  }
  function rand() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

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
      q."shuffleQuestions",
      q."shuffleOptions",
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

  // ── Per-intern shuffle ────────────────────────────────────────────────────
  // Uses attemptId as seed so the same intern always sees the same order
  // when resuming, but different interns get different orderings.
  const finalQuestions = row.shuffleQuestions
    ? seededShuffle(questionsWithOptions, attemptId)
    : questionsWithOptions

  const finalQuestionsWithShuffledOptions = row.shuffleOptions
    ? finalQuestions.map((q, idx) => ({
        ...q,
        // Use a unique seed per question so options are shuffled differently per question
        options: seededShuffle(q.options, `${attemptId}-${idx}`),
      }))
    : finalQuestions

  return (
    <ExamShell
      attemptId={attemptId}
      quizTitle={row.quizTitle}
      timeLimitMinutes={Number(row.timeLimitMinutes)}
      initialSeconds={initialSeconds}
      maxViolations={Number(row.maxViolations)}
      initialViolations={Number(row.violations) || 0}
      questions={finalQuestionsWithShuffledOptions}
      existingAnswers={existingAnswers}
    />
  )
}
