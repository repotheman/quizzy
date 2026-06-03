import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const quizzes = await sql`
    SELECT * FROM quizzes WHERE "createdById" = ${session.user.id}
    ORDER BY "createdAt" DESC
  `
  return NextResponse.json(quizzes)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { title, description, timeLimitMinutes, passingScore, shuffleQuestions, shuffleOptions } = await request.json()

    if (!title || !timeLimitMinutes) {
      return NextResponse.json({ error: "Title and time limit are required" }, { status: 400 })
    }
    if (Number(timeLimitMinutes) <= 0) {
      return NextResponse.json({ error: "Time limit must be greater than 0" }, { status: 400 })
    }
    const ps = Number(passingScore) || 70
    if (ps < 0 || ps > 100) {
      return NextResponse.json({ error: "Passing score must be between 0 and 100" }, { status: 400 })
    }

    const id = generateId()
    await sql`
      INSERT INTO quizzes (id, title, description, "timeLimitMinutes", "passingScore", "shuffleQuestions", "shuffleOptions", "createdById", "updatedAt")
      VALUES (
        ${id},
        ${title},
        ${description || null},
        ${Number(timeLimitMinutes)},
        ${ps},
        ${shuffleQuestions || false},
        ${shuffleOptions || false},
        ${session.user.id},
        NOW()
      )
    `

    return NextResponse.json({ id, message: "Quiz created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Create quiz error:", error)
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 })
  }
}
