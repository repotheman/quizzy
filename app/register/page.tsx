"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { GraduationCap, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react"

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "number", ok: /[0-9]/.test(password) },
  ]
  return (
    <div className="flex gap-3 flex-wrap">
      {checks.map(({ label, ok }) => (
        <span
          key={label}
          className={`flex items-center gap-1 text-xs transition-colors ${
            ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          }`}
        >
          <CheckCircle2 className={`size-3 ${ok ? "opacity-100" : "opacity-30"}`} />
          {label}
        </span>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName]                       = useState("")
  const [email, setEmail]                     = useState("")
  const [password, setPassword]               = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading]             = useState(false)
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "INTERN" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Registration failed")
      toast.success("Account created! Please sign in.")
      router.push("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const passwordsMatch = password && confirmPassword && password === confirmPassword

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary-foreground/15">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Quizzy</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              Your internship<br />assessment starts here.
            </h1>
            <p className="text-primary-foreground/70 text-lg leading-relaxed">
              Create your account and get ready for your assigned quizzes.
            </p>
          </div>

          <div className="rounded-2xl bg-primary-foreground/10 border border-primary-foreground/15 p-6 space-y-3">
            <p className="text-sm font-semibold text-primary-foreground/90">What to expect</p>
            {[
              "Timed, proctored exams in fullscreen",
              "Instant feedback once results are published",
              "Personal leaderboard and score history",
              "One attempt per quiz — no retakes",
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-primary-foreground/70">
                <CheckCircle2 className="size-4 shrink-0 text-primary-foreground/50" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-foreground/40 text-xs">
          © {new Date().getFullYear()} Quizzy. All rights reserved.
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background overflow-y-auto">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <GraduationCap className="size-7 text-primary" />
            <span className="text-xl font-bold">Quizzy</span>
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
            <p className="text-sm text-muted-foreground">
              Register as an intern to access your assigned quizzes
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={`h-11 pr-11 transition-colors ${
                    confirmPassword
                      ? passwordsMatch
                        ? "border-green-500 focus-visible:ring-green-500/20"
                        : "border-destructive focus-visible:ring-destructive/20"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            {/* Role note */}
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Registering as <span className="font-semibold text-foreground">Intern</span>.
              Admin accounts are provisioned by your organisation administrator.
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Creating account…</>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
