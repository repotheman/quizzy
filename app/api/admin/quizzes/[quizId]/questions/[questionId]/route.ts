import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId, questionId } = await params

  try {
    // Verify quiz ownership
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const { type, text, points, options } = await request.json()

    // Update question
    await sql`
      UPDATE questions SET
        type = ${type},
        text = ${text},
        points = ${points || 1},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${questionId} AND "quizId" = ${quizId}
    `

    // Delete existing options and insert new ones
    await sql`DELETE FROM options WHERE "questionId" = ${questionId}`

    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      const optionId = generateId()
      await sql`
        INSERT INTO options (id, "questionId", text, "isCorrect", "order")
        VALUES (${optionId}, ${questionId}, ${option.text}, ${option.isCorrect || false}, ${i + 1})
      `
    }

    return NextResponse.json({ message: "Question updated successfully" })
  } catch (error) {
    console.error("Update question error:", error)
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId, questionId } = await params

  try {
    // Verify quiz ownership
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    await sql`DELETE FROM questions WHERE id = ${questionId} AND "quizId" = ${quizId}`

    return NextResponse.json({ message: "Question deleted successfully" })
  } catch (error) {
    console.error("Delete question error:", error)
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 })
  }
}
