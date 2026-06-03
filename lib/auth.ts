import NextAuth from "next-auth"
import "next-auth/jwt"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { sql } from "@/lib/db"
import type { User } from "@/lib/db"

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "INTERN"
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: "ADMIN" | "INTERN"
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "ADMIN" | "INTERN"
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        const users = await sql`
          SELECT * FROM users WHERE email = ${email}
        ` as User[]

        if (users.length === 0) {
          return null
        }

        const user = users[0]
        const isPasswordValid = await compare(password, user.password)

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.sub = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
        session.user.email = (token.email as string) || session.user.email
        session.user.name = (token.name as string) || session.user.name
        session.user.role = token.role as "ADMIN" | "INTERN"
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — expires after a full work day
  },
  trustHost: true,
  basePath: "/api/auth",
  secret: process.env.AUTH_SECRET,
})
