import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attemptId } = await params

  let aiFeedback: unknown
  try {
    const body = await request.json()
    aiFeedback = body?.aiFeedback
  } catch {
    return NextResponse.json({ error: "aiFeedback must be valid JSON" }, { status: 400 })
  }

  if (aiFeedback !== null && typeof aiFeedback !== "object") {
    return NextResponse.json({ error: "aiFeedback must be an object or array" }, { status: 422 })
  }

  const [ownership] = await sql`
    SELECT qa.id
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa.id = ${attemptId}
    AND q."createdById" = ${session.user.id}
  `
  if (!ownership) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
  }

  try {
    if (aiFeedback === null) {
      await sql`
        UPDATE quiz_attempts
        SET "ai_feedback" = NULL
        WHERE id = ${attemptId}
      `
    } else {
      const payload = JSON.stringify(aiFeedback)
      await sql`
        UPDATE quiz_attempts
        SET "ai_feedback" = ${payload}::jsonb
        WHERE id = ${attemptId}
      `
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("AI feedback update error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
