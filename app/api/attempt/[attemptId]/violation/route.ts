import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"
import { finalizeAttempt } from "@/lib/attempts"
import type { ViolationType } from "@/lib/db"

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
    const { type } = await request.json() as { type: ViolationType }

    if (!type) {
      return NextResponse.json({ error: "Violation type is required" }, { status: 400 })
    }

    // Fetch attempt + quiz maxViolations in one query
    const [attempt] = await sql`
      SELECT
        qa.id,
        qa.status,
        qa.violations,
        q."maxViolations"
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

    const newViolations = Number(attempt.violations) + 1

    // Log the violation
    await sql`
      INSERT INTO violations (id, "attemptId", type, timestamp)
      VALUES (${generateId()}, ${attemptId}, ${type}, NOW())
    `

    // Update violation count
    await sql`
      UPDATE quiz_attempts
      SET violations = ${newViolations}
      WHERE id = ${attemptId}
    `

    // Auto-terminate if max violations reached
    if (newViolations >= Number(attempt.maxViolations)) {
      await finalizeAttempt({
        attemptId,
        internId:   session.user.id,
        autoSubmit: true,
        reason:     "TERMINATED",
      })

      return NextResponse.json({
        violations: newViolations,
        terminated: true,
      })
    }

    return NextResponse.json({ violations: newViolations, terminated: false })
  } catch (error) {
    console.error("[violation/route] error:", error)
    return NextResponse.json({ error: "Failed to log violation" }, { status: 500 })
  }
}
