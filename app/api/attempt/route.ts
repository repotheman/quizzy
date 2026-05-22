import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "INTERN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quizId } = await request.json()

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    // Check if quiz is assigned to this intern
    const assignments = await sql`
      SELECT qa.id FROM quiz_assignments qa
      WHERE qa."quizId" = ${quizId} 
      AND qa."internId" = ${session.user.id}
    `

    if (assignments.length === 0) {
      return NextResponse.json({ error: "Quiz not assigned to you" }, { status: 403 })
    }

    // Check for existing in-progress attempt
    const existingAttempts = await sql`
      SELECT id, status FROM quiz_attempts
      WHERE "quizId" = ${quizId}
      AND "internId" = ${session.user.id}
      AND status = 'IN_PROGRESS'
    `

    if (existingAttempts.length > 0) {
      return NextResponse.json({ attemptId: existingAttempts[0].id })
    }

    // Check if already completed
    const completedAttempts = await sql`
      SELECT id FROM quiz_attempts
      WHERE "quizId" = ${quizId}
      AND "internId" = ${session.user.id}
      AND status = 'SUBMITTED'
    `

    if (completedAttempts.length > 0) {
      return NextResponse.json({ error: "Quiz already completed" }, { status: 400 })
    }

    // Get quiz details for total points
    const questions = await sql`
      SELECT SUM(points) as total FROM questions WHERE "quizId" = ${quizId}
    `
    const totalPoints = questions[0]?.total || 0

    // Create new attempt
    const attemptId = generateId()
    await sql`
      INSERT INTO quiz_attempts (id, "quizId", "internId", status, "totalPoints", violations, "autoSubmitted", "startedAt")
      VALUES (${attemptId}, ${quizId}, ${session.user.id}, 'IN_PROGRESS', ${totalPoints}, 0, false, NOW())
    `

    return NextResponse.json({ attemptId })
  } catch (error) {
    console.error("Failed to create attempt:", error)
    return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "INTERN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get("attemptId")

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID required" }, { status: 400 })
    }

    // Get attempt with quiz and questions
    const attempts = await sql`
      SELECT 
        qa.*,
        q.title as quiz_title,
        q."timeLimitMinutes",
        q."maxViolations"
      FROM quiz_attempts qa
      JOIN quizzes q ON qa."quizId" = q.id
      WHERE qa.id = ${attemptId}
      AND qa."internId" = ${session.user.id}
    `

    if (attempts.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

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

    // Get options for all questions
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
    const questionsWithOptions = questions.map((q: { id: string; text: string; type: string; points: number; order: number }) => ({
      ...q,
      options: options.filter((o: { questionId: string }) => o.questionId === q.id),
    }))

    // Build answers map
    const answersMap: Record<string, string> = {}
    answers.forEach((a: { questionId: string; selectedOptionId: string | null }) => {
      if (a.selectedOptionId) {
        answersMap[a.questionId] = a.selectedOptionId
      }
    })

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        violations: attempt.violations,
        startedAt: attempt.startedAt,
      },
      quiz: {
        id: attempt.quizId,
        title: attempt.quiz_title,
        timeLimitMinutes: attempt.timeLimitMinutes,
        maxViolations: attempt.maxViolations || 3,
      },
      questions: questionsWithOptions,
      answers: answersMap,
    })
  } catch (error) {
    console.error("Failed to get attempt:", error)
    return NextResponse.json({ error: "Failed to get attempt" }, { status: 500 })
  }
}
