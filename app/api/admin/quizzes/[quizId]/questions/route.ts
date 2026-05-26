import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${quizId}`
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

  const questions = await sql`
    SELECT * FROM questions WHERE "quizId" = ${quizId} ORDER BY "order" ASC
  `
  const questionsWithOptions = await Promise.all(
    questions.map(async (q) => {
      const options = await sql`
        SELECT * FROM options WHERE "questionId" = ${q.id} ORDER BY "order" ASC
      `
      return { ...q, options }
    })
  )

  return NextResponse.json(questionsWithOptions)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  try {
    const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${quizId}`
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

    const [{ max_order }] = await sql`
      SELECT COALESCE(MAX("order"), 0) AS max_order FROM questions WHERE "quizId" = ${quizId}
    `
    const questionId = generateId()

    await sql`
      INSERT INTO questions (id, "quizId", type, text, points, "order")
      VALUES (${questionId}, ${quizId}, ${type}, ${text.trim()}, ${Number(points) || 1}, ${Number(max_order) + 1})
    `
    for (let i = 0; i < options.length; i++) {
      await sql`
        INSERT INTO options (id, "questionId", text, "isCorrect", "order")
        VALUES (${generateId()}, ${questionId}, ${options[i].text}, ${options[i].isCorrect || false}, ${i + 1})
      `
    }

    return NextResponse.json({ id: questionId }, { status: 201 })
  } catch (error) {
    console.error("[POST questions]", error)
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 })
  }
}
