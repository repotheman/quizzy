import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { quizId, internId, internIds, internEmails, assignToAll, dueDate, startAt, endAt } = await request.json()

    if (!quizId || (!internId && !internIds && !internEmails && !assignToAll)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if quiz exists (don't require isPublished — caller handles publish first)
    const [quiz] = await sql`
      SELECT id FROM quizzes WHERE id = ${quizId}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Resolve intern IDs from input
    let internIdsToAssign: string[] = []

    if (assignToAll) {
      const rows = await sql`SELECT id FROM users WHERE role = 'INTERN'`
      internIdsToAssign = rows.map((r: any) => r.id)
    } else if (internIds && Array.isArray(internIds)) {
      internIdsToAssign = internIds
    } else if (internId) {
      internIdsToAssign = [internId]
    } else if (internEmails && Array.isArray(internEmails)) {
      // Fix: use = ANY() instead of IN() for neon driver compatibility
      const rows = await sql`
        SELECT id, email FROM users WHERE email = ANY(${internEmails}) AND role = 'INTERN'
      `
      internIdsToAssign = rows.map((r: any) => r.id)
    }

    if (internIdsToAssign.length === 0) {
      return NextResponse.json({ error: "No valid interns found to assign" }, { status: 404 })
    }

    const results: { internId: string; id?: string; status: string }[] = []

    for (const iid of internIdsToAssign) {
      // verify intern exists and role
      const [intern] = await sql`
        SELECT id FROM users WHERE id = ${iid} AND role = 'INTERN'
      `
      if (!intern) {
        results.push({ internId: iid, status: "not_found" })
        continue
      }

      const [existing] = await sql`
        SELECT id FROM quiz_assignments WHERE "quizId" = ${quizId} AND "internId" = ${iid}
      `

      if (existing) {
        results.push({ internId: iid, id: existing.id, status: "already_assigned" })
        continue
      }

      const id = generateId()
      await sql`
        INSERT INTO quiz_assignments (id, "quizId", "internId", "assignedById", "dueDate", "startAt", "endAt")
        VALUES (${id}, ${quizId}, ${iid}, ${session.user.id}, ${dueDate ? new Date(dueDate) : null}, ${startAt ? new Date(startAt) : null}, ${endAt ? new Date(endAt) : null})
      `

      results.push({ internId: iid, id, status: "assigned" })
    }

    return NextResponse.json({ message: "Assignment processed", results }, { status: 201 })
  } catch (error) {
    console.error("Assign quiz error:", error)
    return NextResponse.json({ error: "Failed to assign quiz" }, { status: 500 })
  }
}
