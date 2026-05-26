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
      return NextResponse.json({ error: "questionId and selectedOptionId are required" }, { status: 400 })
    }

    // Verify attempt + get elapsed time and deadline — all from DB
    const [attempt] = await sql`
      SELECT
        qa.id,
        qa."quizId",
        qa.status,
        q."timeLimitMinutes",
        EXTRACT(EPOCH FROM (NOW() - qa."startedAt"))::int AS elapsed_seconds,
        asg."endAt",
        asg."endAt" IS NOT NULL AND NOW() > asg."endAt"    AS deadline_passed
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa."quizId"
      LEFT JOIN quiz_assignments asg
        ON asg."quizId" = qa."quizId" AND asg."internId" = qa."internId"
      WHERE qa.id = ${attemptId}
      AND qa."internId" = ${session.user.id}
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Attempt is not in progress" }, { status: 400 })
    }

    const timeLimitSeconds = Number(attempt.timeLimitMinutes) * 60
    const elapsedSeconds = Number(attempt.elapsed_seconds)

    // 10s grace for network latency
    if (elapsedSeconds > timeLimitSeconds + 10 || attempt.deadline_passed) {
      return NextResponse.json({ error: "Time limit expired" }, { status: 403 })
    }

    // Verify question belongs to this quiz
    const [question] = await sql`
      SELECT id FROM questions WHERE id = ${questionId} AND "quizId" = ${attempt.quizId}
    `
    if (!question) {
      return NextResponse.json({ error: "Question not found in this quiz" }, { status: 404 })
    }

    // Verify option belongs to this question
    const [option] = await sql`
      SELECT id FROM options WHERE id = ${selectedOptionId} AND "questionId" = ${questionId}
    `
    if (!option) {
      return NextResponse.json({ error: "Invalid option for this question" }, { status: 400 })
    }

    // Check correctness
    const [correctOption] = await sql`
      SELECT id FROM options WHERE "questionId" = ${questionId} AND "isCorrect" = true LIMIT 1
    `
    const isCorrect = correctOption?.id === selectedOptionId

    // Upsert — answers table has unique(attemptId, questionId)
    await sql`
      INSERT INTO answers (id, "attemptId", "questionId", "selectedOptionId", "isCorrect", "answeredAt")
      VALUES (${generateId()}, ${attemptId}, ${questionId}, ${selectedOptionId}, ${isCorrect}, NOW())
      ON CONFLICT ("attemptId", "questionId")
      DO UPDATE SET
        "selectedOptionId" = ${selectedOptionId},
        "isCorrect"        = ${isCorrect},
        "answeredAt"       = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[answer/route]", error)
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
  }
}
