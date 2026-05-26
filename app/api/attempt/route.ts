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

    // 1. Verify assignment and check window using DB time
    const [assignment] = await sql`
      SELECT
        "startAt",
        "endAt",
        NOW() < "startAt"                                    AS not_started,
        "endAt" IS NOT NULL AND NOW() > "endAt"              AS deadline_passed
      FROM quiz_assignments
      WHERE "quizId" = ${quizId}
      AND "internId" = ${session.user.id}
    `
    if (!assignment) {
      return NextResponse.json({ error: "Quiz not assigned to you" }, { status: 403 })
    }
    if (assignment.not_started) {
      return NextResponse.json({ error: "Quiz has not started yet" }, { status: 403 })
    }
    if (assignment.deadline_passed) {
      return NextResponse.json({ error: "Quiz deadline has passed" }, { status: 403 })
    }

    // 2. Fetch quiz time limit
    const [quiz] = await sql`
      SELECT "timeLimitMinutes" FROM quizzes WHERE id = ${quizId}
    `
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }
    const timeLimitSeconds = Number(quiz.timeLimitMinutes) * 60

    // 3. Check for existing attempt using DB-side elapsed time
    const [existing] = await sql`
      SELECT
        id,
        status,
        EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int AS elapsed_seconds
      FROM quiz_attempts
      WHERE "quizId" = ${quizId}
      AND "internId" = ${session.user.id}
      ORDER BY "startedAt" DESC
      LIMIT 1
    `

    if (existing) {
      if (existing.status !== "IN_PROGRESS") {
        return NextResponse.json({ attemptId: existing.id, status: existing.status })
      }

      const elapsedSeconds = Number(existing.elapsed_seconds)

      if (elapsedSeconds < timeLimitSeconds) {
        // Still valid — resume it
        return NextResponse.json({ attemptId: existing.id })
      }

      // Expired — finalize before creating fresh one
      await sql`
        UPDATE quiz_attempts SET
          status            = 'TIMED_OUT',
          "autoSubmitted"   = true,
          "submittedAt"     = NOW(),
          "timeSpentSeconds"= ${elapsedSeconds}
        WHERE id = ${existing.id}
      `
    }

    // 4. Create fresh attempt — use DB NOW() for startedAt
    const [{ total }] = await sql`
      SELECT COALESCE(SUM(points), 0) AS total FROM questions WHERE "quizId" = ${quizId}
    `
    const attemptId = generateId()
    await sql`
      INSERT INTO quiz_attempts
        (id, "quizId", "internId", status, "totalPoints", violations, "autoSubmitted", "startedAt")
      VALUES
        (${attemptId}, ${quizId}, ${session.user.id}, 'IN_PROGRESS', ${Number(total)}, 0, false, NOW())
    `

    return NextResponse.json({ attemptId })
  } catch (error) {
    console.error("[POST /api/attempt]", error)
    return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 })
  }
}
