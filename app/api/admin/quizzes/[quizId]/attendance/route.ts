import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { classifyIntern } from "@/lib/attendance"
import type { AttendanceRecord, AttendanceResponse } from "@/lib/attendance"

/**
 * GET /api/admin/quizzes/[quizId]/attendance
 * Returns quiz metadata and per-intern attendance records for live monitoring.
 * Requires authenticated ADMIN session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quizId } = await params

    // ── Quiz metadata ──────────────────────────────────────────────────────────
    const [quiz] = await sql`
      SELECT
        q.id,
        q.title,
        q."timeLimitMinutes",
        MIN(qa."startAt") AS "startAt",
        MAX(qa."endAt")   AS "endAt"
      FROM quizzes q
      LEFT JOIN quiz_assignments qa ON qa."quizId" = q.id
      WHERE q.id = ${quizId} AND q."createdById" = ${session.user.id}
      GROUP BY q.id, q.title, q."timeLimitMinutes"
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // ── Intern attendance records ──────────────────────────────────────────────
    const rows = await sql`
      SELECT
        u.id             AS "internId",
        u.name           AS "internName",
        u.email          AS "internEmail",
        qa."joinedAt",
        at.status        AS "attemptStatus",
        at."startedAt",
        COALESCE(at.violations, 0) AS violations
      FROM quiz_assignments qa
      JOIN users u ON u.id = qa."internId"
      LEFT JOIN quiz_attempts at
        ON at."internId" = qa."internId"
        AND at."quizId"  = qa."quizId"
      WHERE qa."quizId" = ${quizId}
      ORDER BY
        CASE
          WHEN at.status = 'IN_PROGRESS' THEN 1
          WHEN qa."joinedAt" IS NULL     THEN 2
          ELSE 3
        END,
        u.name ASC
    `

    const interns: AttendanceRecord[] = rows.map((row) => ({
      internId: row.internId as string,
      internName: row.internName as string,
      internEmail: row.internEmail as string,
      status: classifyIntern({
        joinedAt: row.joinedAt as string | null,
        attemptStatus: row.attemptStatus as string | null,
      }),
      joinedAt: row.joinedAt ? (row.joinedAt as Date).toISOString() : null,
      startedAt: row.startedAt ? (row.startedAt as Date).toISOString() : null,
      attemptStatus: row.attemptStatus as string | null,
      violations: Number(row.violations),
    }))

    const response: AttendanceResponse = {
      quiz: {
        id: quiz.id as string,
        title: quiz.title as string,
        timeLimitMinutes: Number(quiz.timeLimitMinutes),
        startAt: quiz.startAt ? (quiz.startAt as Date).toISOString() : null,
        endAt: quiz.endAt ? (quiz.endAt as Date).toISOString() : null,
      },
      interns,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[attendance/route]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
