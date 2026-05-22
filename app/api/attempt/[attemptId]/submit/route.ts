import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

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
    const { autoSubmit, reason } = await request.json() as { autoSubmit?: boolean; reason?: string }

    // Verify attempt belongs to user
    const attempts = await sql`
      SELECT qa.*, q."timeLimitMinutes", q."passingScore"
      FROM quiz_attempts qa
      JOIN quizzes q ON qa."quizId" = q.id
      WHERE qa.id = ${attemptId}
      AND qa."internId" = ${session.user.id}
    `

    if (attempts.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attempts[0]

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Attempt is not in progress" }, { status: 400 })
    }

    // Calculate time spent
    const startedAt = new Date(attempt.startedAt)
    const now = new Date()
    const timeSpentSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
    const timeLimitSeconds = attempt.timeLimitMinutes * 60

    // Determine status
    let status = "SUBMITTED"
    if (autoSubmit && reason === "TERMINATED") {
      status = "TERMINATED"
    } else if (timeSpentSeconds > timeLimitSeconds) {
      status = "TIMED_OUT"
    }

    // Calculate score
    const answers = await sql`
      SELECT a."questionId", a."isCorrect", q.points
      FROM answers a
      JOIN questions q ON a."questionId" = q.id
      WHERE a."attemptId" = ${attemptId}
    `

    const score = answers
      .filter((a: { isCorrect: boolean }) => a.isCorrect)
      .reduce((sum: number, a: { points: number }) => sum + a.points, 0)

    const totalPoints = attempt.totalPoints || 0
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 1000) / 10 : 0
    const passed = percentage >= (attempt.passingScore || 60)

    // Update attempt
    await sql`
      UPDATE quiz_attempts
      SET 
        status = ${status},
        score = ${score},
        percentage = ${percentage},
        passed = ${passed},
        "autoSubmitted" = ${autoSubmit || false},
        "submittedAt" = NOW(),
        "timeSpentSeconds" = ${timeSpentSeconds}
      WHERE id = ${attemptId}
    `

    return NextResponse.json({
      score,
      totalPoints,
      percentage,
      passed,
      status,
      timeSpentSeconds,
    })
  } catch (error) {
    console.error("Failed to submit attempt:", error)
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 })
  }
}
