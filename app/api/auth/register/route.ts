import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { sql, generateId } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/mail"

export async function POST(request: Request) {
  try {
    const { name, email, password, role, department } = await request.json()

    // Validate input
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    if (!["ADMIN", "INTERN"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      )
    }

    // ADMIN accounts can only be created by an existing admin.
    // Self-registration is restricted to INTERN only.
    if (role === "ADMIN") {
      return NextResponse.json(
        { error: "Admin accounts cannot be self-registered. Contact your administrator." },
        { status: 403 }
      )
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email}
    `

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user
    const id = generateId()
    await sql`
      INSERT INTO users (id, email, password, name, role, department, "updatedAt")
      VALUES (${id}, ${email}, ${hashedPassword}, ${name}, ${role}, ${department || null}, NOW())
    `

    // Generate Verification Token
    const token = generateId()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    await sql`
      INSERT INTO verification_tokens (id, email, token, "expiresAt")
      VALUES (${generateId()}, ${email}, ${token}, ${expiresAt})
    `

    // Send email
    await sendVerificationEmail(email, token)

    return NextResponse.json(
      { message: "Account created! Please check your email to verify your account before logging in.", id },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
