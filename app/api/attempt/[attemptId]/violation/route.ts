import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"
import type { ViolationType } from "@/lib/db"

const VALID_VIOLATION_TYPES = new Set<ViolationType>([
  "TAB_SWITCH",
  "FULLSCREEN_EXIT",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "RIGHT_CLICK",
  "DEVTOOLS_OPEN",
  "CONTEXT_MENU",
  "WINDOW_BLUR",
])

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
    const body = await request.json() as { type: ViolationType }
    const { type } = body

    // Validate violation type at runtime — never trust the client
    if (!type || !VALID_VIOLATION_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid violation type" }, { status: 400 })
    }

    // Load attempt to verify ownership and status
    const [attempt] = await sql`
      SELECT qa.id, qa.status, qa.violations
      FROM quiz_attempts qa
      WHERE qa.id         = ${attemptId}
      AND   qa."internId" = ${session.user.id}
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    if (attempt.status !== "IN_PROGRESS") {
      // Attempt already finalized — silently accept so the client doesn't error out
      return NextResponse.json({ violations: Number(attempt.violations), terminated: false })
    }

    // Log the violation event
    await sql`
      INSERT INTO violations (id, "attemptId", type, timestamp)
      VALUES (${generateId()}, ${attemptId}, ${type}, NOW())
    `

    // Atomic increment — avoids read-modify-write race condition
    const [updated] = await sql`
      UPDATE quiz_attempts
      SET violations = violations + 1
      WHERE id = ${attemptId}
      RETURNING violations
    `

    const newCount = Number(updated.violations)

    // Auto-submit on max violations is intentionally NOT done here.
    // Only the timer (server-side elapsed check) triggers auto-submit.
    // Violations are tracked and shown to admins but never force-terminate the exam.
    return NextResponse.json({ violations: newCount, terminated: false })
  } catch (error) {
    console.error("[violation/route] error:", error)
    return NextResponse.json({ error: "Failed to log violation" }, { status: 500 })
  }
}
