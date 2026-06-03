import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

// ── GET — export attempt data as a prompt for Claude/ChatGPT ──────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attemptId } = await params

  // Load attempt + intern + quiz
  const [attempt] = await sql`
    SELECT
      qa.id, qa.score, qa."totalPoints", qa.percentage, qa.passed,
      qa."timeSpentSeconds", qa.violations, qa.status,
      u.name  AS intern_name,
      u.email AS intern_email,
      q.title AS quiz_title,
      q."passingScore"
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa."internId"
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa.id = ${attemptId}
  `
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })

  // Load questions + answers + options
  const questions = await sql`
    SELECT
      q.id, q.text, q.points,
      a."selectedOptionId",
      a."isCorrect"
    FROM questions q
    LEFT JOIN answers a ON a."questionId" = q.id AND a."attemptId" = ${attemptId}
    WHERE q."quizId" = (
      SELECT "quizId" FROM quiz_attempts WHERE id = ${attemptId}
    )
    ORDER BY q."order" ASC
  `

  const questionIds = questions.map((q) => q.id as string)
  const allOptions = questionIds.length > 0
    ? await sql`
        SELECT id, "questionId", text, "isCorrect"
        FROM options
        WHERE "questionId" = ANY(${questionIds}::text[])
        ORDER BY "questionId", "order" ASC
      `
    : []

  // Build structured data
  const optionsByQ = new Map<string, typeof allOptions>()
  for (const o of allOptions) {
    const qid = o.questionId as string
    if (!optionsByQ.has(qid)) optionsByQ.set(qid, [])
    optionsByQ.get(qid)!.push(o)
  }

  const questionsData = questions.map((q) => {
    const opts = optionsByQ.get(q.id as string) ?? []
    const correctOption = opts.find((o) => o.isCorrect)
    const selectedOption = opts.find((o) => o.id === q.selectedOptionId)
    return {
      question: q.text as string,
      points: Number(q.points),
      options: opts.map((o) => o.text as string),
      correct_answer: correctOption?.text ?? "N/A",
      intern_answer: selectedOption?.text ?? "Not answered",
      is_correct: Boolean(q.isCorrect),
    }
  })

  const attemptData = {
    intern: {
      name: attempt.intern_name as string,
      email: attempt.intern_email as string,
    },
    quiz: {
      title: attempt.quiz_title as string,
      passing_score_pct: Number(attempt.passingScore),
    },
    result: {
      score: Number(attempt.score),
      total_points: Number(attempt.totalPoints),
      percentage: Number(attempt.percentage),
      passed: Boolean(attempt.passed),
      time_spent_seconds: Number(attempt.timeSpentSeconds),
      violations: Number(attempt.violations),
      status: attempt.status as string,
    },
    questions: questionsData,
  }

  const prompt = `You are an expert educational assessor. Analyse the following quiz attempt data and generate structured feedback for the intern.

Return ONLY valid JSON — no explanation, no markdown, no code fences. The JSON must exactly match this schema:

{
  "overall_summary": "2-3 sentence summary of overall performance",
  "performance_level": "Excellent" | "Good" | "Average" | "Needs Improvement" | "Poor",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area to improve 1", "area to improve 2"],
  "wrong_questions": [
    {
      "question": "question text",
      "intern_answer": "what they chose",
      "correct_answer": "correct option",
      "tip": "brief explanation of the correct concept"
    }
  ],
  "time_assessment": "Comment on their time usage (they had ${Math.round(Number(attempt.totalPoints) > 0 ? (Number(attempt.timeSpentSeconds) / 60) : 0)} minutes)",
  "recommended_topics": ["topic 1", "topic 2"],
  "encouragement": "One motivational sentence tailored to their performance"
}

--- ATTEMPT DATA ---
${JSON.stringify(attemptData, null, 2)}
--- END DATA ---`

  return NextResponse.json({ prompt, attemptData })
}

// ── POST — save AI feedback JSON ──────────────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attemptId } = await params

  let feedback: unknown
  try {
    const body = await request.json()
    feedback = body.feedback
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!feedback || typeof feedback !== "object") {
    return NextResponse.json({ error: "feedback must be a JSON object" }, { status: 400 })
  }

  // Validate required fields
  const f = feedback as Record<string, unknown>
  if (!f.overall_summary || !f.performance_level) {
    return NextResponse.json(
      { error: "Invalid feedback format. Must include overall_summary and performance_level." },
      { status: 422 }
    )
  }

  const [attempt] = await sql`
    SELECT id FROM quiz_attempts WHERE id = ${attemptId}
  `
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })

  await sql`
    UPDATE quiz_attempts
    SET "aiFeedback" = ${JSON.stringify(feedback)}
    WHERE id = ${attemptId}
  `

  return NextResponse.json({ success: true })
}

// ── DELETE — remove feedback ──────────────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attemptId } = await params

  await sql`
    UPDATE quiz_attempts SET "aiFeedback" = NULL WHERE id = ${attemptId}
  `

  return NextResponse.json({ success: true })
}
