import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="mx-auto w-full max-w-md p-8 bg-background shadow-lg sm:rounded-xl text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Invalid Link</h1>
          <p className="text-muted-foreground mb-6">No verification token was provided.</p>
          <Link href="/login"><Button>Go to Login</Button></Link>
        </div>
      </div>
    )
  }

  // Find token
  const tokens = await sql`
    SELECT id, email, "expiresAt" FROM verification_tokens WHERE token = ${token}
  `

  if (tokens.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="mx-auto w-full max-w-md p-8 bg-background shadow-lg sm:rounded-xl text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Invalid Token</h1>
          <p className="text-muted-foreground mb-6">The verification link is invalid or has already been used.</p>
          <Link href="/login"><Button>Go to Login</Button></Link>
        </div>
      </div>
    )
  }

  const vt = tokens[0]

  if (new Date(vt.expiresAt) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="mx-auto w-full max-w-md p-8 bg-background shadow-lg sm:rounded-xl text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Token Expired</h1>
          <p className="text-muted-foreground mb-6">Your verification link has expired. Please register again or contact support.</p>
          <Link href="/register"><Button>Register Again</Button></Link>
        </div>
      </div>
    )
  }

  // Verify user
  await sql`
    UPDATE users SET "emailVerified" = NOW() WHERE email = ${vt.email}
  `

  // Delete token
  await sql`
    DELETE FROM verification_tokens WHERE id = ${vt.id}
  `

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="mx-auto w-full max-w-md p-8 bg-background shadow-lg sm:rounded-xl text-center">
        <div className="mb-4 text-green-600">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h1 className="text-2xl font-bold mb-4">Email Verified!</h1>
        <p className="text-muted-foreground mb-6">Your account is now fully verified. You can now log in.</p>
        <Link href="/login"><Button className="w-full">Go to Login</Button></Link>
      </div>
    </div>
  )
}
