"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface ScoreOverrideFormProps {
  attemptId: string
  status: string
  totalPoints: number
  currentScore: number | null
}

export function ScoreOverrideForm({
  attemptId,
  status,
  totalPoints,
  currentScore,
}: ScoreOverrideFormProps) {
  const router = useRouter()
  const [value, setValue] = useState(String(currentScore ?? 0))
  const [loading, setLoading] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  if (status === "IN_PROGRESS") {
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInlineError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreOverride: Number(value) }),
      })
      const data = await res.json()

      if (res.status === 422) {
        setInlineError(data.error ?? "Invalid score value")
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to override score")
      }

      toast.success("Score updated successfully")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to override score")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="score-override">Override Score</Label>
        <Input
          id="score-override"
          type="number"
          min={0}
          max={totalPoints}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setInlineError(null)
          }}
          className="w-40"
          aria-describedby={inlineError ? "score-override-error" : "score-override-hint"}
        />
        {inlineError ? (
          <p id="score-override-error" className="text-sm text-destructive">
            {inlineError}
          </p>
        ) : (
          <p id="score-override-hint" className="text-sm text-muted-foreground">
            Enter a value between 0 and {totalPoints}
          </p>
        )}
      </div>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Apply Override
      </Button>
    </form>
  )
}
