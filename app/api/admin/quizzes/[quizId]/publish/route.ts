import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { publishResults } from "@/lib/attempts"

/**
 * POST /api/admin/quizzes/[quizId]/publish
 * Manually publish results for a quiz.
 * Admin can do this at any time regardless of whether all interns have finished.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quizId } = await params

    const [quiz] = await sql`
      SELECT id, "resultsPublishedAt" FROM quizzes
      WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }
    if (quiz.resultsPublishedAt !== null) {
      return NextResponse.json({ error: "Results already published" }, { status: 409 })
    }

    await publishResults(quizId, session.user.id)

    return NextResponse.json({ message: "Results published successfully" })
  } catch (error) {
    console.error("[publish/route]", error)
    return NextResponse.json({ error: "Failed to publish results" }, { status: 500 })
  }
}
