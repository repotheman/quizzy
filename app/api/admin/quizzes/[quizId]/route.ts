import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  const [quiz] = await sql`
    SELECT * FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
  `

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
  }

  return NextResponse.json(quiz)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  try {
    const updates = await request.json()
    const { title, description, timeLimitMinutes, passingScore, shuffleQuestions, isPublished } = updates

    // Build update query dynamically
    const [existingQuiz] = await sql`
      SELECT * FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `

    if (!existingQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    await sql`
      UPDATE quizzes SET
        title = ${title ?? existingQuiz.title},
        description = ${description ?? existingQuiz.description},
        "timeLimitMinutes" = ${timeLimitMinutes ?? existingQuiz.timeLimitMinutes},
        "passingScore" = ${passingScore ?? existingQuiz.passingScore},
        "shuffleQuestions" = ${shuffleQuestions ?? existingQuiz.shuffleQuestions},
        "isPublished" = ${isPublished ?? existingQuiz.isPublished},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${quizId}
    `

    return NextResponse.json({ message: "Quiz updated successfully" })
  } catch (error) {
    console.error("Update quiz error:", error)
    return NextResponse.json({ error: "Failed to update quiz" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { quizId } = await params

  try {
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId} AND "createdById" = ${session.user.id}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    await sql`DELETE FROM quizzes WHERE id = ${quizId}`

    return NextResponse.json({ message: "Quiz deleted successfully" })
  } catch (error) {
    console.error("Delete quiz error:", error)
    return NextResponse.json({ error: "Failed to delete quiz" }, { status: 500 })
  }
}
