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

  const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}`
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

  // Single query — join questions with their options, then reshape in JS
  const rows = await sql`
    SELECT
      q.id           AS question_id,
      q.type,
      q.text,
      q.points,
      q."order"      AS question_order,
      q."createdAt"  AS question_created_at,
      q."updatedAt"  AS question_updated_at,
      o.id           AS option_id,
      o.text         AS option_text,
      o."isCorrect"  AS option_is_correct,
      o."order"      AS option_order
    FROM questions q
    LEFT JOIN options o ON o."questionId" = q.id
    WHERE q."quizId" = ${quizId}
    ORDER BY q."order" ASC, o."order" ASC
  `

  // Reshape flat rows into nested questions-with-options
  const questionsMap = new Map<string, {
    id: string; type: string; text: string; points: number; order: number;
    createdAt: unknown; updatedAt: unknown; quizId: string;
    options: { id: string; text: string; isCorrect: boolean; order: number }[]
  }>()

  for (const row of rows) {
    const qid = row.question_id as string
    if (!questionsMap.has(qid)) {
      questionsMap.set(qid, {
        id: qid,
        quizId,
        type: row.type as string,
        text: row.text as string,
        points: Number(row.points),
        order: Number(row.question_order),
        createdAt: row.question_created_at,
        updatedAt: row.question_updated_at,
        options: [],
      })
    }
    if (row.option_id) {
      questionsMap.get(qid)!.options.push({
        id: row.option_id as string,
        text: row.option_text as string,
        isCorrect: row.option_is_correct as boolean,
        order: Number(row.option_order),
      })
    }
  }

  return NextResponse.json([...questionsMap.values()])
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

    const [{ max_order }] = await sql`
      SELECT COALESCE(MAX("order"), 0) AS max_order FROM questions WHERE "quizId" = ${quizId}
    `
    const questionId = generateId()

    await sql`
      INSERT INTO questions (id, "quizId", type, text, points, "order", "updatedAt")
      VALUES (${questionId}, ${quizId}, ${type}, ${text.trim()}, ${Number(points) || 1}, ${Number(max_order) + 1}, NOW())
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
