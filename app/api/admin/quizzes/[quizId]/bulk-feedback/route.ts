import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

// ── GET — generate a bulk prompt for all finalized attempts in a quiz ──────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  const [quiz] = await sql`
    SELECT id, title, "passingScore", "timeLimitMinutes"
    FROM quizzes WHERE id = ${quizId}
  `
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

  // All finalized attempts for this quiz
  const attempts = await sql`
    SELECT
      qa.id, qa.score, qa."totalPoints", qa.percentage, qa.passed,
      qa."timeSpentSeconds", qa.violations, qa.status,
      u.name AS intern_name, u.email AS intern_email
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa."internId"
    WHERE qa."quizId" = ${quizId}
    AND   qa.status  != 'IN_PROGRESS'
    ORDER BY qa.percentage DESC NULLS LAST
  `

  if (attempts.length === 0) {
    return NextResponse.json({ error: "No finalized attempts found for this quiz" }, { status: 404 })
  }

  // Questions + options (same for all students)
  const questions = await sql`
    SELECT id, text, points, "order"
    FROM questions WHERE "quizId" = ${quizId}
    ORDER BY "order" ASC
  `
  const questionIds = questions.map((q) => q.id as string)
  const allOptions  = questionIds.length > 0
    ? await sql`
        SELECT id, "questionId", text, "isCorrect"
        FROM options
        WHERE "questionId" = ANY(${questionIds}::text[])
        ORDER BY "questionId", "order" ASC
      `
    : []

  const optsByQ = new Map<string, typeof allOptions>()
  for (const o of allOptions) {
    const qid = o.questionId as string
    if (!optsByQ.has(qid)) optsByQ.set(qid, [])
    optsByQ.get(qid)!.push(o)
  }

  // Answers for all attempts at once
  const attemptIds = attempts.map((a) => a.id as string)
  const allAnswers = attemptIds.length > 0
    ? await sql`
        SELECT "attemptId", "questionId", "selectedOptionId", "isCorrect"
        FROM answers
        WHERE "attemptId" = ANY(${attemptIds}::text[])
      `
    : []

  // Group answers by attemptId → questionId
  const answersByAttempt = new Map<string, Map<string, { selectedOptionId: string | null; isCorrect: boolean | null }>>()
  for (const a of allAnswers) {
    const aid = a.attemptId as string
    if (!answersByAttempt.has(aid)) answersByAttempt.set(aid, new Map())
    answersByAttempt.get(aid)!.set(a.questionId as string, {
      selectedOptionId: a.selectedOptionId as string | null,
      isCorrect: a.isCorrect as boolean | null,
    })
  }

  // Build per-student data
  const studentsData = attempts.map((att) => {
    const attAnswers = answersByAttempt.get(att.id as string) ?? new Map()

    const qs = questions.map((q) => {
      const opts     = optsByQ.get(q.id as string) ?? []
      const ans      = attAnswers.get(q.id as string)
      const correct  = opts.find((o) => o.isCorrect)
      const selected = opts.find((o) => o.id === ans?.selectedOptionId)

      return {
        question:       q.text as string,
        points:         Number(q.points),
        correct_answer: correct?.text  ?? "N/A",
        intern_answer:  selected?.text ?? "Not answered",
        is_correct:     ans?.isCorrect ?? false,
      }
    })

    return {
      attempt_id:       att.id as string,
      intern_name:      att.intern_name as string,
      intern_email:     att.intern_email as string,
      score:            Number(att.score),
      total_points:     Number(att.totalPoints),
      percentage:       Number(att.percentage),
      passed:           Boolean(att.passed),
      time_spent_sec:   Number(att.timeSpentSeconds),
      violations:       Number(att.violations),
      questions:        qs,
    }
  })

  const prompt = `You are an expert educational assessor reviewing quiz results for "${quiz.title as string}".

Analyse EACH student's attempt individually and return a JSON array.
Return ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must be an array where each element has EXACTLY this schema:
[
  {
    "attempt_id": "<exact attempt_id from the data>",
    "overall_summary": "2-3 sentence personalised summary",
    "performance_level": "Excellent" | "Good" | "Average" | "Needs Improvement" | "Poor",
    "strengths": ["strength 1", "strength 2"],
    "improvements": ["area 1", "area 2"],
    "wrong_questions": [
      {
        "question": "question text",
        "intern_answer": "what they chose",
        "correct_answer": "correct option",
        "tip": "brief concept explanation"
      }
    ],
    "time_assessment": "comment on time usage",
    "recommended_topics": ["topic 1", "topic 2"],
    "encouragement": "one motivational sentence"
  }
]

Quiz info: passing score ${quiz.passingScore as number}%, time limit ${quiz.timeLimitMinutes as number} minutes.

--- STUDENT DATA (${studentsData.length} students) ---
${JSON.stringify(studentsData, null, 2)}
--- END DATA ---`

  return NextResponse.json({
    prompt,
    studentCount: studentsData.length,
    attemptIds: attemptIds,
  })
}

// ── POST — save bulk feedback (array of { attempt_id, ...feedback }) ──────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  // Verify quiz exists and admin has access
  const [quiz] = await sql`SELECT id FROM quizzes WHERE id = ${quizId}`
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

  let feedbackArray: unknown
  try {
    const body = await request.json()
    feedbackArray = body.feedback
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(feedbackArray)) {
    return NextResponse.json({ error: "feedback must be a JSON array" }, { status: 400 })
  }

  let saved = 0
  const errors: string[] = []

  for (const item of feedbackArray) {
    const f = item as Record<string, unknown>
    const attemptId = f.attempt_id as string | undefined

    if (!attemptId) { errors.push("Item missing attempt_id"); continue }
    if (!f.overall_summary || !f.performance_level) {
      errors.push(`attempt ${attemptId}: missing required fields`)
      continue
    }

    try {
      await sql`
        UPDATE quiz_attempts
        SET "ai_feedback" = ${JSON.stringify(f)}::jsonb
        WHERE id = ${attemptId}
        AND "quizId" = ${quizId}
      `
      saved++
    } catch {
      errors.push(`attempt ${attemptId}: DB error`)
    }
  }

  return NextResponse.json({ saved, errors, total: feedbackArray.length })
}
