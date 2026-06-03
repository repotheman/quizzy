"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"

interface RescoreButtonProps {
  quizId: string
}

export function RescoreButton({ quizId }: RescoreButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleRescore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/rescore`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to rescore")
      } else {
        toast.success(data.message ?? "Scores recalculated successfully")
      }
    } catch {
      toast.error("Network error — could not rescore")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRescore}
      disabled={loading}
      title="Recalculate all attempt scores using current question points"
    >
      <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Rescoring…" : "Rescore"}
    </Button>
  )
}
