import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { QuizEditor } from "./quiz-editor"

async function getQuizWithQuestions(quizId: string, adminId: string) {
  const [quiz] = (await sql`
    SELECT * FROM quizzes WHERE id = ${quizId} AND "createdById" = ${adminId}
  `) as any[]

  if (!quiz) return null

  const questions = (await sql`
    SELECT * FROM questions WHERE "quizId" = ${quizId} ORDER BY "order" ASC
  `) as any[]

  // Batch-load all options in a single query instead of N+1
  const questionIds = questions.map((q: any) => q.id as string)
  const allOptions = questionIds.length > 0
    ? (await sql`
        SELECT * FROM options WHERE "questionId" = ANY(${questionIds}::text[]) ORDER BY "questionId", "order" ASC
      `) as any[]
    : []

  // Group options by questionId
  const optionsByQuestion = new Map<string, any[]>()
  for (const opt of allOptions) {
    const qid = opt.questionId as string
    if (!optionsByQuestion.has(qid)) optionsByQuestion.set(qid, [])
    optionsByQuestion.get(qid)!.push(opt)
  }

  const questionsWithOptions = questions.map((q: any) => ({
    ...q,
    options: optionsByQuestion.get(q.id as string) ?? [],
  }))

  return { ...quiz, questions: questionsWithOptions }
}

// Fix H6: add auth guard, remove unsafe session! assertion
export default async function EditQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")
  const { quizId } = await params
  const quiz = await getQuizWithQuestions(quizId, session.user.id)

  if (!quiz) {
    notFound()
  }

  return <QuizEditor quiz={quiz} />
}
