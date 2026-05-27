import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { unpublishResults } from "@/lib/attempts"

/**
 * POST /api/admin/quizzes/[quizId]/unpublish
 * Unpublish results for a quiz, clearing ranks and hiding scores from interns.
 * Requirements: 3.1, 3.5, 3.6, 3.9
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

    await unpublishResults(quizId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }

    if (error?.status === 404) {
      return NextResponse.json({ error: error.message ?? "Quiz not found" }, { status: 404 })
    }
    if (error?.status === 409) {
      return NextResponse.json({ error: error.message ?? "Results are not published" }, { status: 409 })
    }

    console.error("[unpublish/route]", err)
    return NextResponse.json({ error: "Failed to unpublish results" }, { status: 500 })
  }
}
