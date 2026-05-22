import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "INTERN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { attemptId } = await params
    const { questionId, selectedOptionId } = await request.json()

    if (!questionId || !selectedOptionId) {
      return NextResponse.json({ error: "Question ID and selected option are required" }, { status: 400 })
    }

    // Verify attempt belongs to user and is in progress
    const attempts = await sql`
      SELECT id, "quizId", status FROM quiz_attempts
      WHERE id = ${attemptId}
      AND "internId" = ${session.user.id}
    `

    if (attempts.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attempts[0]

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Attempt is not in progress" }, { status: 400 })
    }

    // Verify question belongs to this quiz
    const questions = await sql`
      SELECT id FROM questions
      WHERE id = ${questionId}
      AND "quizId" = ${attempt.quizId}
    `

    if (questions.length === 0) {
      return NextResponse.json({ error: "Question not found in this quiz" }, { status: 404 })
    }

    // Get the correct option for this question to check if answer is correct
    const correctOptions = await sql`
      SELECT id FROM options
      WHERE "questionId" = ${questionId}
      AND "isCorrect" = true
    `

    const isCorrect = correctOptions.length > 0 && correctOptions[0].id === selectedOptionId

    // Upsert answer
    const existingAnswers = await sql`
      SELECT id FROM answers
      WHERE "attemptId" = ${attemptId}
      AND "questionId" = ${questionId}
    `

    if (existingAnswers.length > 0) {
      await sql`
        UPDATE answers
        SET "selectedOptionId" = ${selectedOptionId}, "isCorrect" = ${isCorrect}, "answeredAt" = NOW()
        WHERE "attemptId" = ${attemptId}
        AND "questionId" = ${questionId}
      `
    } else {
      await sql`
        INSERT INTO answers (id, "attemptId", "questionId", "selectedOptionId", "isCorrect", "answeredAt")
        VALUES (${generateId()}, ${attemptId}, ${questionId}, ${selectedOptionId}, ${isCorrect}, NOW())
      `
    }

    // Don't expose isCorrect to client during exam
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to save answer:", error)
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
  }
}
