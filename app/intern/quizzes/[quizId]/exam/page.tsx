import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { ExamShell } from "@/components/exam/ExamShell"

async function getAttemptData(attemptId: string, internId: string) {
  // Get attempt with quiz details
  const attempts = await sql`
    SELECT 
      qa.*,
      q.title as quiz_title,
      q."timeLimitMinutes",
      COALESCE(q."maxViolations", 3) as "maxViolations"
    FROM quiz_attempts qa
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa.id = ${attemptId}
    AND qa."internId" = ${internId}
  `

  if (attempts.length === 0) return null

  const attempt = attempts[0]

  // Get questions with options
  const questions = await sql`
    SELECT 
      q.id,
      q.text,
      q.type,
      q.points,
      q."order"
    FROM questions q
    WHERE q."quizId" = ${attempt.quizId}
    ORDER BY q."order" ASC
  `

  const questionIds = questions.map((q: { id: string }) => q.id)
  const options = questionIds.length > 0 ? await sql`
    SELECT id, "questionId", text, "order"
    FROM options
    WHERE "questionId" = ANY(${questionIds})
    ORDER BY "order" ASC
  ` : []

  // Get existing answers
  const answers = await sql`
    SELECT "questionId", "selectedOptionId"
    FROM answers
    WHERE "attemptId" = ${attemptId}
  `

  // Build questions with options
  const questionsWithOptions = questions.map((q: { id: string; text: string; type: "MCQ" | "TRUE_FALSE"; points: number; order: number }) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    points: q.points,
    options: options
      .filter((o: { questionId: string }) => o.questionId === q.id)
      .map((o: { id: string; text: string }) => ({ id: o.id, text: o.text })),
  }))

  // Build answers map
  const answersMap: Record<string, string> = {}
  answers.forEach((a: { questionId: string; selectedOptionId: string | null }) => {
    if (a.selectedOptionId) {
      answersMap[a.questionId] = a.selectedOptionId
    }
  })

  return {
    attempt: {
      id: attempt.id,
      quizId: attempt.quizId,
      status: attempt.status,
      violations: attempt.violations || 0,
      startedAt: attempt.startedAt,
    },
    quiz: {
      title: attempt.quiz_title,
      timeLimitMinutes: attempt.timeLimitMinutes,
      maxViolations: attempt.maxViolations,
    },
    questions: questionsWithOptions,
    answers: answersMap,
  }
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

  if (!attemptId) {
    redirect(`/intern/quizzes/${quizId}`)
  }

  const data = await getAttemptData(attemptId, session.user.id)

  if (!data) {
    redirect(`/intern/quizzes/${quizId}`)
  }

  if (data.attempt.status !== "IN_PROGRESS") {
    redirect("/intern/history")
  }

  return (
    <ExamShell
      attemptId={data.attempt.id}
      quizId={data.attempt.quizId}
      quizTitle={data.quiz.title}
      timeLimitMinutes={data.quiz.timeLimitMinutes}
      maxViolations={data.quiz.maxViolations}
      startedAt={data.attempt.startedAt}
      initialViolations={data.attempt.violations}
      questions={data.questions}
      existingAnswers={data.answers}
    />
  )
}
