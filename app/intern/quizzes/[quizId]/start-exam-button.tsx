"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface StartExamButtonProps {
  quizId: string
  hasInProgressAttempt: boolean
  attemptId?: string
  isLocked?: boolean
  unavailableReason?: string
}

export function StartExamButton({
  quizId,
  hasInProgressAttempt,
  attemptId,
  isLocked = false,
  unavailableReason,
}: StartExamButtonProps) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    setIsLoading(true)
    try {
      if (hasInProgressAttempt && attemptId) {
        // Resuming — request fullscreen now (user gesture), then navigate.
        // ExamShell will re-request on mount if it drops during navigation.
        try { await document.documentElement.requestFullscreen() } catch { /* handled by ExamShell overlay */ }
        router.push(`/intern/quizzes/${quizId}/exam?attemptId=${attemptId}`)
        return
      }

      if (isLocked) {
        setIsLoading(false)
        return
      }

      const response = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        toast.error(error.error || "Failed to start exam")
        setIsLoading(false)
        return
      }

      const { attemptId: newAttemptId, status } = await response.json()

      if (status && status !== "IN_PROGRESS") {
        toast.error("You have already completed this quiz.", {
          description: "Open your history page to review the result.",
        })
        router.push("/intern/history")
        return
      }

      // Request fullscreen after the attempt is created (still within the
      // same user-gesture call stack on most browsers).
      try { await document.documentElement.requestFullscreen() } catch { /* handled by ExamShell overlay */ }

      router.push(`/intern/quizzes/${quizId}/exam?attemptId=${newAttemptId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start exam")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="agree"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
        />
        <Label htmlFor="agree" className="text-sm">
          I have read and agree to the exam rules
        </Label>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!agreed || isLoading || (isLocked && !hasInProgressAttempt)}
        onClick={handleStart}
        title={isLocked ? unavailableReason || "This quiz is unavailable" : undefined}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Starting...
          </>
        ) : hasInProgressAttempt ? (
          "Continue Exam"
        ) : isLocked ? (
          "Unavailable"
        ) : (
          "Enter Exam"
        )}
      </Button>

      {isLocked && unavailableReason && (
        <p className="text-sm text-muted-foreground">{unavailableReason}</p>
      )}
    </div>
  )
}
