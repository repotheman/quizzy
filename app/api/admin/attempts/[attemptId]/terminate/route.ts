import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { adminTerminateAttempt } from "@/lib/attempts"

export async function POST(
  request: Request,
  { params }: { params: { attemptId: string } }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attemptId } = params

  // Parse optional reason from request body
  let reason: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.reason === "string" && body.reason.length > 0) {
      reason = body.reason
    }
  } catch {
    // Body is optional — ignore parse errors
  }

  try {
    const result = await adminTerminateAttempt(attemptId, session.user.id, reason)
    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    if (error?.status === 404) {
      return NextResponse.json({ error: error.message ?? "Attempt not found" }, { status: 404 })
    }
    if (error?.status === 409) {
      return NextResponse.json({ error: error.message ?? "Attempt is already finalized" }, { status: 409 })
    }
    console.error("Terminate attempt error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
