import { NextResponse } from "next/server"
import { sql, generateId } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/mail"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const users = await sql`SELECT id FROM users WHERE email = ${email}`
    if (users.length === 0) {
      // Don't leak that the email doesn't exist
      return NextResponse.json({ message: "If an account exists, a reset link was sent." }, { status: 200 })
    }

    // Generate Reset Token
    const token = generateId()
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour

    // Delete any existing tokens for this email
    await sql`DELETE FROM password_reset_tokens WHERE email = ${email}`

    // Insert new token
    await sql`
      INSERT INTO password_reset_tokens (id, email, token, "expiresAt")
      VALUES (${generateId()}, ${email}, ${token}, ${expiresAt})
    `

    // Send email
    await sendPasswordResetEmail(email, token)

    return NextResponse.json({ message: "If an account exists, a reset link was sent." }, { status: 200 })
  } catch (error: any) {
    console.error("Forgot password error:", error)
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 })
  }
}
