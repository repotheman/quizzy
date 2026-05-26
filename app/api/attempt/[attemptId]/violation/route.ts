import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"
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

    const [attempt] = await sql`
      SELECT id, status, violations FROM quiz_attempts
      WHERE id = ${attemptId} AND "internId" = ${session.user.id}
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Attempt is not in progress" }, { status: 400 })
    }

    const newViolations = Number(attempt.violations) + 1

    await sql`
      INSERT INTO violations (id, "attemptId", type, timestamp)
      VALUES (${generateId()}, ${attemptId}, ${type}, NOW())
    `
    await sql`
      UPDATE quiz_attempts SET violations = ${newViolations} WHERE id = ${attemptId}
    `

    return NextResponse.json({ violations: newViolations })
  } catch (error) {
    console.error("[violation/route] error:", error)
    return NextResponse.json({ error: "Failed to log violation" }, { status: 500 })
  }
}
