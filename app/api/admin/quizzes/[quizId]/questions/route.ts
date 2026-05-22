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

  // Verify quiz ownership
  const [quiz] = await sql`
    SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
  `

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
  }

  const questions = await sql`
    SELECT * FROM questions WHERE "quizId" = ${quizId} ORDER BY "order" ASC
  `

  // Get options for each question
  const questionsWithOptions = await Promise.all(
    questions.map(async (question) => {
      const options = await sql`
        SELECT * FROM options WHERE "questionId" = ${question.id} ORDER BY "order" ASC
      `
      return { ...question, options }
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
    // Verify quiz ownership
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const { type, text, points, options } = await request.json()

    if (!type || !text || !options || options.length < 2) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the next order number
    const [{ max_order }] = await sql`
      SELECT COALESCE(MAX("order"), 0) as max_order FROM questions WHERE "quizId" = ${quizId}
    `

    const questionId = generateId()
    const nextOrder = Number(max_order) + 1

    await sql`
      INSERT INTO questions (id, "quizId", type, text, points, "order")
      VALUES (${questionId}, ${quizId}, ${type}, ${text}, ${points || 1}, ${nextOrder})
    `

    // Insert options
    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      const optionId = generateId()
      await sql`
        INSERT INTO options (id, "questionId", text, "isCorrect", "order")
        VALUES (${optionId}, ${questionId}, ${option.text}, ${option.isCorrect || false}, ${i + 1})
      `
    }

    return NextResponse.json({ id: questionId, message: "Question created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Create question error:", error)
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 })
  }
}
