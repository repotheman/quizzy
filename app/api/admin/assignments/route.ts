import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { quizId, internId, dueDate } = await request.json()

    if (!quizId || !internId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if quiz exists and is published
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId} AND "isPublished" = true
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found or not published" }, { status: 404 })
    }

    // Check if intern exists
    const [intern] = await sql`
      SELECT id FROM users WHERE id = ${internId} AND role = 'INTERN'
    `

    if (!intern) {
      return NextResponse.json({ error: "Intern not found" }, { status: 404 })
    }

    // Check if already assigned
    const [existing] = await sql`
      SELECT id FROM quiz_assignments WHERE "quizId" = ${quizId} AND "internId" = ${internId}
    `

    if (existing) {
      return NextResponse.json({ error: "Quiz already assigned to this intern" }, { status: 400 })
    }

    const id = generateId()
    
    await sql`
      INSERT INTO quiz_assignments (id, "quizId", "internId", "assignedById", "dueDate")
      VALUES (${id}, ${quizId}, ${internId}, ${session.user.id}, ${dueDate ? new Date(dueDate) : null})
    `

    return NextResponse.json({ id, message: "Quiz assigned successfully" }, { status: 201 })
  } catch (error) {
    console.error("Assign quiz error:", error)
    return NextResponse.json({ error: "Failed to assign quiz" }, { status: 500 })
  }
}
