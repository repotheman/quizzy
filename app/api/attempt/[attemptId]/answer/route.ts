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
      return NextResponse.json(
        { error: "questionId and selectedOptionId are required" },
        { status: 400 }
      )
    }

    // Verify attempt ownership + check time limit — all from DB
    const [attempt] = await sql`
      SELECT
        qa.id,
        qa."quizId",
        qa.status,
        q."timeLimitMinutes",
        EXTRACT(EPOCH FROM (NOW() - qa."startedAt"))::int AS elapsed_seconds
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa."quizId"
      WHERE qa.id        = ${attemptId}
      AND   qa."internId" = ${session.user.id}
    `
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Attempt is not in progress" }, { status: 400 })
    }

    // Hard cutoff — no grace period. Timer is based on startedAt, not endAt.
    const timeLimitSeconds = Number(attempt.timeLimitMinutes) * 60
    const elapsedSeconds   = Number(attempt.elapsed_seconds)

    if (elapsedSeconds > timeLimitSeconds) {
      return NextResponse.json({ error: "Time limit expired" }, { status: 403 })
    }

    // Verify question belongs to this quiz
    const [question] = await sql`
      SELECT id FROM questions
      WHERE id = ${questionId} AND "quizId" = ${attempt.quizId}
    `
    if (!question) {
      return NextResponse.json({ error: "Question not found in this quiz" }, { status: 404 })
    }

    // Verify option belongs to this question
    const [option] = await sql`
      SELECT id FROM options
      WHERE id = ${selectedOptionId} AND "questionId" = ${questionId}
    `
    if (!option) {
      return NextResponse.json({ error: "Invalid option for this question" }, { status: 400 })
    }

    // Upsert answer — isCorrect is intentionally left NULL here.
    // It gets set in bulk when the attempt is finalized (lib/attempts.ts).
    await sql`
      INSERT INTO answers
        (id, "attemptId", "questionId", "selectedOptionId", "isCorrect", "answeredAt", "updatedAt")
      VALUES
        (${generateId()}, ${attemptId}, ${questionId}, ${selectedOptionId}, NULL, NOW(), NOW())
      ON CONFLICT ("attemptId", "questionId")
      DO UPDATE SET
        "selectedOptionId" = ${selectedOptionId},
        "isCorrect"        = NULL,
        "updatedAt"        = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[answer/route]", error)
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
  }
}
