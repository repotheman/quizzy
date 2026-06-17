import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { sql } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 })
    }

    const tokens = await sql`
      SELECT id, email, "expiresAt" FROM password_reset_tokens WHERE token = ${token}
    `

    if (tokens.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
    }

    const rt = tokens[0]

    if (new Date(rt.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Reset token has expired" }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await hash(password, 12)

    // Update the user's password
    await sql`
      UPDATE users SET password = ${hashedPassword}, "updatedAt" = NOW() WHERE email = ${rt.email}
    `

    // Delete the token so it can't be reused
    await sql`
      DELETE FROM password_reset_tokens WHERE id = ${rt.id}
    `

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}
