import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql, generateId } from "@/lib/db"

export async function POST(request: Request) {
  const session = await auth()

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      quizId,
      internId,
      internIds,
      internEmails,
      assignToAll,
      startAt,
      endAt,
    } = await request.json()

    if (!quizId || (!internId && !internIds && !internEmails && !assignToAll)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate window: if both provided, startAt must be before endAt
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      return NextResponse.json(
        { error: "startAt must be before endAt" },
        { status: 400 }
      )
    }

    // Quiz must exist and be published before assigning
    const [quiz] = await sql`
      SELECT id, "isPublished" FROM quizzes WHERE id = ${quizId}
    `
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }
    if (!quiz.isPublished) {
      return NextResponse.json(
        { error: "Quiz must be published before assigning to interns" },
        { status: 400 }
      )
    }

    // Resolve intern IDs
    let internIdsToAssign: string[] = []

    if (assignToAll) {
      const rows = await sql`SELECT id FROM users WHERE role = 'INTERN'`
      internIdsToAssign = rows.map((r: { id: string }) => r.id)
    } else if (internIds && Array.isArray(internIds)) {
      internIdsToAssign = internIds
    } else if (internId) {
      internIdsToAssign = [internId]
    } else if (internEmails && Array.isArray(internEmails)) {
      const rows = await sql`
        SELECT id FROM users
        WHERE email = ANY(${internEmails}) AND role = 'INTERN'
      `
      internIdsToAssign = rows.map((r: { id: string }) => r.id)
    }

    if (internIdsToAssign.length === 0) {
      return NextResponse.json({ error: "No valid interns found to assign" }, { status: 404 })
    }

    const results: { internId: string; id?: string; status: string }[] = []

    for (const iid of internIdsToAssign) {
      const [intern] = await sql`
        SELECT id FROM users WHERE id = ${iid} AND role = 'INTERN'
      `
      if (!intern) {
        results.push({ internId: iid, status: "not_found" })
        continue
      }

      const [existing] = await sql`
        SELECT id FROM quiz_assignments
        WHERE "quizId" = ${quizId} AND "internId" = ${iid}
      `
      if (existing) {
        // Update the window times on re-assign (e.g. after unpublish → republish)
        await sql`
          UPDATE quiz_assignments
          SET
            "startAt"      = ${startAt ? new Date(startAt) : null},
            "endAt"        = ${endAt   ? new Date(endAt)   : null},
            "assignedById" = ${session.user.id}
          WHERE id = ${existing.id}
        `
        results.push({ internId: iid, id: existing.id, status: "updated" })
        continue
      }

      const id = generateId()
      await sql`
        INSERT INTO quiz_assignments
          (id, "quizId", "internId", "assignedById", "startAt", "endAt")
        VALUES
          (
            ${id},
            ${quizId},
            ${iid},
            ${session.user.id},
            ${startAt ? new Date(startAt) : null},
            ${endAt   ? new Date(endAt)   : null}
          )
      `
      results.push({ internId: iid, id, status: "assigned" })
    }

    return NextResponse.json({ message: "Assignment processed", results }, { status: 201 })
  } catch (error) {
    console.error("[assignments/route]", error)
    return NextResponse.json({ error: "Failed to assign quiz" }, { status: 500 })
  }
}
