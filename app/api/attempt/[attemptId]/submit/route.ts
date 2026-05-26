import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { finalizeAttempt } from "@/lib/attempts"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "INTERN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { attemptId } = await params
    const { autoSubmit, reason } = await request.json() as { autoSubmit?: boolean; reason?: string }

    const result = await finalizeAttempt({
      attemptId,
      internId: session.user.id,
      autoSubmit,
      reason,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to submit attempt:", error)
    const message = error instanceof Error ? error.message : "Failed to submit attempt"
    const status = message === "Attempt not found" ? 404 : message === "Attempt is not in progress" ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
