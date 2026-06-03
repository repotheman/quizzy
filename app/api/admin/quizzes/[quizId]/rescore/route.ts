import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { rescoreAttempts } from "@/lib/attempts"

/**
 * POST /api/admin/quizzes/[quizId]/rescore
 *
 * Re-scores all finalized attempts for this quiz using the current question
 * points in the database. Use this after directly editing question points
 * in Neon (or any other DB tool) to sync attempt scores/percentages/ranks.
 *
 * - Skips attempts where score was manually overridden by an admin.
 * - Re-computes ranks if results are already published.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quizId } = await params

    // Verify quiz exists and belongs to this admin
    const [quiz] = await sql`
      SELECT id, title FROM quizzes
      WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    await rescoreAttempts(quizId)

    return NextResponse.json({
      message: `Scores recalculated for quiz "${quiz.title}"`,
    })
  } catch (error) {
    console.error("[rescore/route]", error)
    return NextResponse.json({ error: "Failed to rescore attempts" }, { status: 500 })
  }
}
