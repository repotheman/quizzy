import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const interns = await sql`
      SELECT id, name, email FROM users WHERE role = 'INTERN' ORDER BY name ASC
    `

    return NextResponse.json(interns)
  } catch (error) {
    console.error("Fetch interns error:", error)
    return NextResponse.json({ error: "Failed to fetch interns" }, { status: 500 })
  }
}
