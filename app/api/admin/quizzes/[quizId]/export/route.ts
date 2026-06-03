import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { csvEscape } from "@/lib/csv"

/**
 * GET /api/admin/quizzes/[quizId]/export
 * Export all finalized attempt results for a quiz as a CSV file.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { quizId } = await params

    // Fetch quiz title for the filename slug — verify ownership
    const [quiz] = await sql`
      SELECT id, title FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `
    if (!quiz) {
      return new Response(JSON.stringify({ error: "Quiz not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Query all finalized attempts with intern name/email
    const attempts = await sql`
      SELECT
        qa.id                       AS attempt_id,
        u.name                      AS intern_name,
        u.email                     AS intern_email,
        qa.status,
        qa.score,
        qa."totalPoints"            AS total_points,
        qa.percentage,
        qa.passed,
        qa.rank,
        qa.violations,
        qa."timeSpentSeconds"       AS time_spent_seconds,
        qa."startedAt"              AS started_at,
        qa."submittedAt"            AS submitted_at
      FROM quiz_attempts qa
      JOIN users u ON u.id = qa."internId"
      WHERE qa."quizId" = ${quizId}
        AND qa.status != 'IN_PROGRESS'
      ORDER BY qa.percentage DESC NULLS LAST, qa."timeSpentSeconds" ASC NULLS LAST
    `

    // Build CSV
    const header = [
      "attempt_id",
      "intern_name",
      "intern_email",
      "status",
      "score",
      "total_points",
      "percentage",
      "passed",
      "rank",
      "violations",
      "time_spent_seconds",
      "started_at",
      "submitted_at",
    ].join(",")

    const rows = attempts.map((row) => {
      const fields = [
        csvEscape(String(row.attempt_id ?? "")),
        csvEscape(String(row.intern_name ?? "")),
        csvEscape(String(row.intern_email ?? "")),
        csvEscape(String(row.status ?? "")),
        row.score != null ? String(row.score) : "",
        row.total_points != null ? String(row.total_points) : "",
        row.percentage != null ? String(row.percentage) : "",
        row.passed != null ? String(row.passed) : "",
        row.rank != null ? String(row.rank) : "",
        row.violations != null ? String(row.violations) : "",
        row.time_spent_seconds != null ? String(row.time_spent_seconds) : "",
        row.started_at != null ? new Date(row.started_at).toISOString() : "",
        row.submitted_at != null ? new Date(row.submitted_at).toISOString() : "",
      ]
      return fields.join(",")
    })

    const csv = [header, ...rows].join("\n")

    // Generate slug from quiz title
    const slug = quiz.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    const date = new Date().toISOString().slice(0, 10)
    const filename = `results-${slug}-${date}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[export/route]", error)
    return new Response(JSON.stringify({ error: "Failed to export results" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
