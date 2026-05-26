import { notFound } from "next/navigation"
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

  const questionsWithOptions = await Promise.all(
    questions.map(async (question) => {
      const options = (await sql`
        SELECT * FROM options WHERE "questionId" = ${question.id} ORDER BY "order" ASC
      `) as any[]
      return { ...question, options }
    })
  )

  return { ...quiz, questions: questionsWithOptions }
}

export default async function EditQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth()
  const { quizId } = await params
  const quiz = await getQuizWithQuestions(quizId, session!.user.id)

  if (!quiz) {
    notFound()
  }

  return <QuizEditor quiz={quiz} />
}
