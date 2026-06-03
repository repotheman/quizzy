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

    // Batch-validate all intern IDs in a single query instead of N+1
    const validInterns = await sql`
      SELECT id FROM users WHERE id = ANY(${internIdsToAssign}::text[]) AND role = 'INTERN'
    `
    const validInternIds = new Set(validInterns.map((r: { id: string }) => r.id))

    // Batch-check existing assignments in a single query instead of N+1
    const existingAssignments = await sql`
      SELECT id, "internId" FROM quiz_assignments
      WHERE "quizId" = ${quizId} AND "internId" = ANY(${internIdsToAssign}::text[])
    `
    const existingByInternId = new Map(
      existingAssignments.map((r: { id: string; internId: string }) => [r.internId, r.id])
    )

    const results: { internId: string; id?: string; status: string }[] = []
    const toInsert: { id: string; internId: string }[] = []
    const toUpdate: string[] = []

    for (const iid of internIdsToAssign) {
      if (!validInternIds.has(iid)) {
        results.push({ internId: iid, status: "not_found" })
        continue
      }

      const existingId = existingByInternId.get(iid)
      if (existingId) {
        toUpdate.push(existingId)
        results.push({ internId: iid, id: existingId, status: "updated" })
      } else {
        const id = generateId()
        toInsert.push({ id, internId: iid })
        results.push({ internId: iid, id, status: "assigned" })
      }
    }

    // Batch update existing assignments
    if (toUpdate.length > 0) {
      await sql`
        UPDATE quiz_assignments
        SET
          "startAt"      = ${startAt ? new Date(startAt) : null},
          "endAt"        = ${endAt   ? new Date(endAt)   : null},
          "assignedById" = ${session.user.id}
        WHERE id = ANY(${toUpdate}::text[])
      `
    }

    // Batch insert new assignments
    for (const item of toInsert) {
      await sql`
        INSERT INTO quiz_assignments
          (id, "quizId", "internId", "assignedById", "startAt", "endAt")
        VALUES
          (
            ${item.id},
            ${quizId},
            ${item.internId},
            ${session.user.id},
            ${startAt ? new Date(startAt) : null},
            ${endAt   ? new Date(endAt)   : null}
          )
      `
    }

    return NextResponse.json({ message: "Assignment processed", results }, { status: 201 })
  } catch (error) {
    console.error("[assignments/route]", error)
    return NextResponse.json({ error: "Failed to assign quiz" }, { status: 500 })
  }
}

