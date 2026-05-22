"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface StartExamButtonProps {
  quizId: string
  hasInProgressAttempt: boolean
  attemptId?: string
}

export function StartExamButton({
  quizId,
  hasInProgressAttempt,
  attemptId,
}: StartExamButtonProps) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    setIsLoading(true)
    try {
      if (hasInProgressAttempt && attemptId) {
        router.push(`/intern/quizzes/${quizId}/exam?attemptId=${attemptId}`)
        return
      }

      const response = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to start exam")
      }

      const { attemptId: newAttemptId } = await response.json()
      router.push(`/intern/quizzes/${quizId}/exam?attemptId=${newAttemptId}`)
    } catch (error) {
      console.error("Failed to start exam:", error)
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
        disabled={!agreed || isLoading}
        onClick={handleStart}
      >
        {isLoading
          ? "Starting..."
          : hasInProgressAttempt
          ? "Continue Exam"
          : "Enter Exam"}
      </Button>
    </div>
  )
}
