import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"
import { finalizeAttempt } from "@/lib/attempts"

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

    // 1. Verify quiz is published + fetch time limit in one query
    const [quiz] = await sql`
      SELECT id, "timeLimitMinutes", "isPublished"
      FROM quizzes
      WHERE id = ${quizId}
    `
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }
    if (!quiz.isPublished) {
      return NextResponse.json({ error: "Quiz is not available" }, { status: 403 })
    }

    // 2. Verify assignment and check join window using DB time
    const [assignment] = await sql`
      SELECT
        id,
        "startAt",
        "endAt",
        "joinedAt",
        "startAt" IS NOT NULL AND NOW() < "startAt"  AS not_started,
        "endAt"   IS NOT NULL AND NOW() > "endAt"    AS window_closed
      FROM quiz_assignments
      WHERE "quizId"   = ${quizId}
      AND   "internId" = ${session.user.id}
    `
    if (!assignment) {
      return NextResponse.json({ error: "Quiz not assigned to you" }, { status: 403 })
    }
    if (assignment.not_started) {
      return NextResponse.json({ error: "Quiz has not started yet" }, { status: 403 })
    }
    if (assignment.window_closed) {
      return NextResponse.json({ error: "The join window for this quiz has closed" }, { status: 403 })
    }

    const timeLimitSeconds = Number(quiz.timeLimitMinutes) * 60

    // 3. Check for existing attempt
    const [existing] = await sql`
      SELECT
        id,
        status,
        EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int AS elapsed_seconds
      FROM quiz_attempts
      WHERE "quizId"   = ${quizId}
      AND   "internId" = ${session.user.id}
    `

    if (existing) {
      if (existing.status !== "IN_PROGRESS") {
        // Already completed — return existing attempt id
        return NextResponse.json({ attemptId: existing.id, status: existing.status })
      }

      const elapsed = Number(existing.elapsed_seconds)

      if (elapsed < timeLimitSeconds) {
        // Still within time limit — resume
        return NextResponse.json({ attemptId: existing.id })
      }

      // Time expired — finalize the old attempt then fall through to create new
      // (shouldn't normally happen since ExamShell auto-submits on timer expiry,
      //  but handles edge cases like browser crash)
      await finalizeAttempt({
        attemptId: existing.id,
        internId:  session.user.id,
        autoSubmit: true,
        reason: "TIMED_OUT",
      })

      return NextResponse.json({ attemptId: existing.id, status: "TIMED_OUT" })
    }

    // 4. Create fresh attempt
    const [{ total }] = await sql`
      SELECT COALESCE(SUM(points), 0) AS total
      FROM questions
      WHERE "quizId" = ${quizId}
    `

    const attemptId = generateId()

    await sql`
      INSERT INTO quiz_attempts
        (id, "quizId", "internId", status, "totalPoints", violations, "autoSubmitted", "startedAt")
      VALUES
        (${attemptId}, ${quizId}, ${session.user.id}, 'IN_PROGRESS', ${Number(total)}, 0, false, NOW())
    `

    // 5. Mark attendance on the assignment
    if (!assignment.joinedAt) {
      await sql`
        UPDATE quiz_assignments
        SET "joinedAt" = NOW()
        WHERE id = ${assignment.id}
      `
    }

    return NextResponse.json({ attemptId })
  } catch (error) {
    console.error("[POST /api/attempt]", error)
    return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 })
  }
}
