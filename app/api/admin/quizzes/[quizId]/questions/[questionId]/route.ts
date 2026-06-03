import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"
import { rescoreAttempts } from "@/lib/attempts"

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
    const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}`
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

    const { type, text, points, options } = await request.json()

    if (!type || !text?.trim()) {
      return NextResponse.json({ error: "type and text are required" }, { status: 400 })
    }
    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: "At least 2 options are required" }, { status: 400 })
    }
    if (!options.some((o: { isCorrect: boolean }) => o.isCorrect)) {
      return NextResponse.json({ error: "At least one option must be marked correct" }, { status: 400 })
    }

    await sql`
      UPDATE questions SET
        type       = ${type},
        text       = ${text.trim()},
        points     = ${Number(points) || 1},
        "updatedAt"= NOW()
      WHERE id = ${questionId} AND "quizId" = ${quizId}
    `

    await sql`DELETE FROM options WHERE "questionId" = ${questionId}`

    // Batch insert options in one query
    if (options.length > 0) {
      const ids      = options.map(() => generateId())
      const qIds     = options.map(() => questionId)
      const texts    = options.map((o: { text: string }) => o.text)
      const corrects = options.map((o: { isCorrect: boolean }) => o.isCorrect || false)
      const orders   = options.map((_: unknown, i: number) => i + 1)

      await sql`
        INSERT INTO options (id, "questionId", text, "isCorrect", "order")
        SELECT * FROM UNNEST(
          ${ids}::text[],
          ${qIds}::text[],
          ${texts}::text[],
          ${corrects}::boolean[],
          ${orders}::int[]
        ) AS t(id, "questionId", text, "isCorrect", "order")
      `
    }

    // Rescore all finalized attempts since points may have changed
    await rescoreAttempts(quizId)

    return NextResponse.json({ message: "Question updated" })
  } catch (error) {
    console.error("[PATCH question]", error)
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
    const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}`
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

    await sql`DELETE FROM questions WHERE id = ${questionId} AND "quizId" = ${quizId}`

    return NextResponse.json({ message: "Question deleted" })
  } catch (error) {
    console.error("[DELETE question]", error)
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 })
  }
}
