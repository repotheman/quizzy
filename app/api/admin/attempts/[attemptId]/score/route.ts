import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { overrideScore } from "@/lib/attempts"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attemptId } = await params

  // Parse and validate scoreOverride from request body
  let scoreOverride: unknown
  try {
    const body = await request.json()
    scoreOverride = body?.scoreOverride
  } catch {
    return NextResponse.json({ error: "scoreOverride must be a number" }, { status: 400 })
  }

  if (typeof scoreOverride !== "number") {
    return NextResponse.json({ error: "scoreOverride must be a number" }, { status: 400 })
  }

  try {
    const result = await overrideScore(attemptId, session.user.id, scoreOverride)
    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    if (error?.status === 404) {
      return NextResponse.json({ error: error.message ?? "Attempt not found" }, { status: 404 })
    }
    if (error?.status === 409) {
      return NextResponse.json({ error: error.message ?? "Cannot override score of an in-progress attempt" }, { status: 409 })
    }
    if (error?.status === 422) {
      return NextResponse.json({ error: error.message ?? "scoreOverride is out of range" }, { status: 422 })
    }
    console.error("Score override error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
