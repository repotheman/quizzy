import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

interface ParsedQuestion {
  type: "MCQ" | "TRUE_FALSE"
  text: string
  points: number
  options: string[]
  correctAnswer: number // 0-based index
}

interface ParseError {
  row: number
  message: string
}

function parseJSON(data: string): { questions: ParsedQuestion[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  let parsed: unknown

  try {
    parsed = JSON.parse(data)
  } catch {
    return { questions: [], errors: [{ row: 0, message: "Invalid JSON format" }] }
  }

  if (!Array.isArray(parsed)) {
    return { questions: [], errors: [{ row: 0, message: "JSON must be an array of questions" }] }
  }

  const questions: ParsedQuestion[] = []

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    const row = i + 1

    if (!item || typeof item !== "object") {
      errors.push({ row, message: "Invalid question object" })
      continue
    }

    const { type, text, codeSnippet, language, points, options, correctAnswer } = item as Record<string, unknown>

    if (!text || typeof text !== "string" || !text.trim()) {
      errors.push({ row, message: "Question text is required" })
      continue
    }

    const qType = (type === "TRUE_FALSE" || type === "true_false" || type === "OUTPUT")
      ? (type === "TRUE_FALSE" || type === "true_false" ? "TRUE_FALSE" : "MCQ")
      : "MCQ"

    // If a codeSnippet field is provided, embed it into the text as a fenced code block
    const lang = typeof language === "string" ? language : (type === "OUTPUT" ? "java" : "")
    const fullText = codeSnippet && typeof codeSnippet === "string"
      ? `${text.trim()}\n\`\`\`${lang}\n${codeSnippet.trim()}\n\`\`\``
      : text.trim()

    let qOptions: string[]
    if (qType === "TRUE_FALSE") {
      qOptions = ["True", "False"]
    } else if (Array.isArray(options) && options.length >= 2) {
      qOptions = options.map((o: unknown) => String(o).trim())
    } else {
      errors.push({ row, message: "MCQ questions need at least 2 options" })
      continue
    }

    if (qOptions.some((o) => !o)) {
      errors.push({ row, message: "All options must be non-empty" })
      continue
    }

    const correctIdx = typeof correctAnswer === "number" ? correctAnswer : parseInt(String(correctAnswer))
    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= qOptions.length) {
      errors.push({ row, message: `correctAnswer must be 0-${qOptions.length - 1}` })
      continue
    }

    questions.push({
      type: qType,
      text: fullText,
      points: typeof points === "number" && points > 0 ? points : 1,
      options: qOptions,
      correctAnswer: correctIdx,
    })
  }

  return { questions, errors }
}

function parseCSV(data: string): { questions: ParsedQuestion[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const questions: ParsedQuestion[] = []
  const lines = data.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  if (lines.length < 2) {
    return { questions: [], errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }] }
  }

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const row = i + 1
    // Simple CSV parse — handle quoted fields
    const fields = parseCSVLine(lines[i])

    if (fields.length < 5) {
      errors.push({ row, message: "Not enough columns. Need: type, text, points, correctAnswer, optionA, optionB, [optionC], [optionD], [optionE], [optionF]" })
      continue
    }

    const [typeRaw, text, pointsRaw, correctRaw, ...optionFields] = fields

    if (!text || !text.trim()) {
      errors.push({ row, message: "Question text is required" })
      continue
    }

    const qType = (typeRaw?.toUpperCase() === "TRUE_FALSE" || typeRaw?.toUpperCase() === "TF") ? "TRUE_FALSE" : "MCQ"

    let qOptions: string[]
    if (qType === "TRUE_FALSE") {
      qOptions = ["True", "False"]
    } else {
      qOptions = optionFields.map((o) => o.trim()).filter(Boolean)
      if (qOptions.length < 2) {
        errors.push({ row, message: "MCQ questions need at least 2 options" })
        continue
      }
    }

    const correctIdx = parseInt(correctRaw)
    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= qOptions.length) {
      errors.push({ row, message: `correctAnswer must be 0-${qOptions.length - 1}` })
      continue
    }

    const points = parseInt(pointsRaw)

    questions.push({
      type: qType,
      text: text.trim(),
      points: isNaN(points) || points <= 0 ? 1 : points,
      options: qOptions,
      correctAnswer: correctIdx,
    })
  }

  return { questions, errors }
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += ch
      }
    }
  }

  fields.push(current.trim())
  return fields
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
    // Verify quiz exists
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const { format, data } = await request.json()

    if (!format || !data) {
      return NextResponse.json({ error: "format and data are required" }, { status: 400 })
    }

    let result: { questions: ParsedQuestion[]; errors: ParseError[] }

    if (format === "json") {
      result = parseJSON(data)
    } else if (format === "csv") {
      result = parseCSV(data)
    } else {
      return NextResponse.json({ error: "format must be 'json' or 'csv'" }, { status: 400 })
    }

    if (result.questions.length === 0 && result.errors.length > 0) {
      return NextResponse.json({
        imported: 0,
        errors: result.errors,
      }, { status: 400 })
    }

    // Get the current max order
    const [{ max_order }] = await sql`
      SELECT COALESCE(MAX("order"), 0) as max_order FROM questions WHERE "quizId" = ${quizId}
    `
    let nextOrder = Number(max_order) + 1

    let imported = 0

    for (const q of result.questions) {
      const questionId = generateId()

      await sql`
        INSERT INTO questions (id, "quizId", type, text, points, "order", "updatedAt")
        VALUES (${questionId}, ${quizId}, ${q.type}, ${q.text}, ${q.points}, ${nextOrder}, NOW())
      `

      for (let j = 0; j < q.options.length; j++) {
        const optionId = generateId()
        await sql`
          INSERT INTO options (id, "questionId", text, "isCorrect", "order")
          VALUES (${optionId}, ${questionId}, ${q.options[j]}, ${j === q.correctAnswer}, ${j + 1})
        `
      }

      nextOrder++
      imported++
    }

    return NextResponse.json({
      imported,
      errors: result.errors,
    }, { status: 201 })
  } catch (error) {
    console.error("Bulk upload error:", error)
    return NextResponse.json({ error: "Failed to import questions" }, { status: 500 })
  }
}
