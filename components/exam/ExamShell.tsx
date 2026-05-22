"use client"

import { useEffect, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useExamStore } from "@/store/examStore"
import { useExamProctor, type ViolationType } from "@/hooks/useExamProctor"
import { useTimer } from "@/hooks/useTimer"
import { TimerBar } from "./TimerBar"
import { QuestionCard } from "./QuestionCard"
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExamShellProps {
  attemptId: string
  quizId: string
  quizTitle: string
  timeLimitMinutes: number
  maxViolations: number
  startedAt: Date
  initialViolations: number
  questions: {
    id: string
    text: string
    type: "MCQ" | "TRUE_FALSE"
    points: number
    options: { id: string; text: string }[]
  }[]
  existingAnswers: Record<string, string>
}

export function ExamShell({
  attemptId,
  quizId,
  quizTitle,
  timeLimitMinutes,
  maxViolations,
  startedAt,
  initialViolations,
  questions,
  existingAnswers,
}: ExamShellProps) {
  const router = useRouter()
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    currentQuestionIndex,
    answers,
    violations,
    timeRemaining,
    isTerminated,
    terminationReason,
    initializeExam,
    setCurrentQuestion,
    nextQuestion,
    prevQuestion,
    setAnswer,
    addViolation,
    setTimeRemaining,
    terminate,
  } = useExamStore()

  // Initialize exam state
  useEffect(() => {
    initializeExam({
      attemptId,
      quizId,
      quizTitle,
      questions,
      maxViolations,
      timeLimitMinutes,
      existingAnswers,
      violations: initialViolations,
      startedAt: new Date(startedAt),
    })
  }, [
    attemptId,
    quizId,
    quizTitle,
    questions,
    maxViolations,
    timeLimitMinutes,
    existingAnswers,
    initialViolations,
    startedAt,
    initializeExam,
  ])

  // Handle exam termination
  const handleTerminate = useCallback(async () => {
    try {
      await fetch(`/api/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSubmit: true, reason: "TERMINATED" }),
      })
      terminate("Maximum violations reached")
    } catch (error) {
      console.error("Failed to terminate:", error)
    }
  }, [attemptId, terminate])

  // Handle violation
  const handleViolation = useCallback(
    (type: ViolationType, count: number) => {
      addViolation()
      const remaining = maxViolations - count
      toast.error(`Violation Detected: ${type.replace(/_/g, " ")}`, {
        description:
          remaining > 0
            ? `Warning: ${remaining} violation${remaining === 1 ? "" : "s"} remaining before auto-submit`
            : "Your exam has been terminated",
      })
    },
    [addViolation, maxViolations]
  )

  // Timer
  useTimer({
    initialSeconds: timeRemaining > 0 ? timeRemaining : timeLimitMinutes * 60,
    onTick: setTimeRemaining,
    onExpire: async () => {
      try {
        await fetch(`/api/attempt/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoSubmit: true, reason: "TIMED_OUT" }),
        })
        router.push(`/intern/history`)
      } catch (error) {
        console.error("Failed to submit on timeout:", error)
      }
    },
    autoStart: true,
  })

  // Proctor hook
  useExamProctor({
    attemptId,
    maxViolations,
    currentViolations: violations,
    onTerminate: handleTerminate,
    onViolation: handleViolation,
    enabled: !isTerminated,
  })

  // Handle answer selection
  const handleSelectOption = async (optionId: string) => {
    const question = questions[currentQuestionIndex]
    setAnswer(question.id, optionId)

    try {
      await fetch(`/api/attempt/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          selectedOptionId: optionId,
        }),
      })
    } catch (error) {
      console.error("Failed to save answer:", error)
      toast.error("Failed to save answer", {
        description: "Please try again",
      })
    }
  }

  // Handle submit
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSubmit: false }),
      })

      if (response.ok) {
        router.push(`/intern/history`)
      }
    } catch (error) {
      console.error("Failed to submit:", error)
      toast.error("Failed to submit exam", {
        description: "Please try again",
      })
    } finally {
      setIsSubmitting(false)
      setShowSubmitDialog(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length

  if (!currentQuestion) {
    return null
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col select-none">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="flex items-center justify-between h-14 px-4">
          <span className="text-sm font-medium">{quizTitle}</span>

          <TimerBar
            timeRemaining={timeRemaining}
            totalTime={timeLimitMinutes * 60}
          />

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Q {currentQuestionIndex + 1} / {questions.length}
            </span>
            {violations > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {violations}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Question area */}
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-2xl">
          <QuestionCard
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            text={currentQuestion.text}
            type={currentQuestion.type}
            points={currentQuestion.points}
            options={currentQuestion.options}
            selectedOptionId={answers[currentQuestion.id] || null}
            onSelectOption={handleSelectOption}
          />
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="sticky bottom-0 border-t bg-background">
        <div className="flex items-center justify-between h-16 px-4">
          <Button
            variant="outline"
            onClick={prevQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="mr-2 size-4" />
            Previous
          </Button>

          {/* Dot navigation */}
          <div className="flex items-center gap-1.5">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  index === currentQuestionIndex
                    ? "bg-primary"
                    : answers[q.id]
                    ? "bg-primary/50"
                    : "bg-muted-foreground/30"
                )}
                aria-label={`Go to question ${index + 1}`}
              />
            ))}
          </div>

          {isLastQuestion ? (
            <Button onClick={() => setShowSubmitDialog(true)}>
              Submit Exam
            </Button>
          ) : (
            <Button variant="outline" onClick={nextQuestion}>
              Next
              <ChevronRight className="ml-2 size-4" />
            </Button>
          )}
        </div>
      </footer>

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                  Warning: You have {questions.length - answeredCount} unanswered
                  questions.
                </span>
              )}
              <span className="block mt-2">
                This action cannot be undone. Are you sure you want to submit?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Termination dialog */}
      <Dialog open={isTerminated} modal>
        <DialogContent
          className="[&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Exam Terminated
            </DialogTitle>
            <DialogDescription>
              {terminationReason || "Your exam has been automatically submitted due to violations."}
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full mt-4" onClick={() => router.push("/intern/history")}>
            View Results
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
