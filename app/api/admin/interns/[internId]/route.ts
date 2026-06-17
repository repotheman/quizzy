import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ internId: string }> | { internId: string } }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const { internId } = resolvedParams;
    const { department } = await request.json()

    await sql`
      UPDATE users
      SET department = ${department || null}, "updatedAt" = NOW()
      WHERE id = ${internId} AND role = 'INTERN'
    `

    return NextResponse.json({ message: "Intern updated successfully" })
  } catch (error) {
    console.error("Update intern error:", error)
    return NextResponse.json({ error: "Failed to update intern" }, { status: 500 })
  }
}
