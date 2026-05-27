"use client"

import { useEffect, useCallback, useState, useRef } from "react"
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
import { toast } from "sonner"
import { useExamProctor, type ViolationType } from "@/hooks/useExamProctor"
import { useTimer } from "@/hooks/useTimer"
import { TimerBar } from "./TimerBar"
import { QuestionCard } from "./QuestionCard"
import { ChevronLeft, ChevronRight, AlertTriangle, Maximize2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Question {
  id: string
  text: string
  type: "MCQ" | "TRUE_FALSE"
  points: number
  options: { id: string; text: string }[]
}

interface ExamShellProps {
  attemptId: string
  quizTitle: string
  timeLimitMinutes: number
  /** Remaining seconds, computed server-side — passed directly to avoid client-side re-computation bugs */
  initialSeconds: number
  maxViolations: number
  initialViolations: number
  questions: Question[]
  existingAnswers: Record<string, string>
}

export function ExamShell({
  attemptId,
  quizTitle,
  timeLimitMinutes,
  initialSeconds,
  maxViolations,
  initialViolations,
  questions,
  existingAnswers,
}: ExamShellProps) {
  const router = useRouter()

  // ── Local state ──────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(existingAnswers)
  const [violations, setViolations] = useState(initialViolations)
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  // ── Auto-recover fullscreen on mount ─────────────────────────────────────
  // Next.js page transitions can drop fullscreen. We attempt to re-enter it
  // immediately on mount, then retry once after a short delay to handle the
  // case where the browser needs a moment after navigation settles.
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>

    const tryFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          // Blocked — the overlay will prompt the user to click
        })
      }
    }

    tryFullscreen()
    // Retry after 800ms in case the first attempt was too early
    retryTimer = setTimeout(tryFullscreen, 800)

    return () => clearTimeout(retryTimer)
  }, [])

  // ── Submit handler ────────────────────────────────────────────────────────
  const submitAttempt = useCallback(async (auto: boolean, reason?: string) => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSubmit: auto, reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to submit exam")
        isSubmittingRef.current = false
        setIsSubmitting(false)
        setShowSubmitDialog(false)
        return
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {})
      }
      router.push("/intern/history")
    } catch {
      toast.error("Failed to submit exam. Please try again.")
      isSubmittingRef.current = false
      setIsSubmitting(false)
      setShowSubmitDialog(false)
    }
  }, [attemptId, router])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useTimer({
    initialSeconds,
    onTick: setTimeRemaining,
    onExpire: () => submitAttempt(true, "TIMED_OUT"),
  })

  // ── Proctoring ────────────────────────────────────────────────────────────
  const handleViolation = useCallback((type: ViolationType, newCount: number, terminated: boolean) => {
    setViolations(newCount)
    if (terminated) {
      toast.error("Exam terminated due to too many violations.", {
        description: "You will be redirected shortly.",
        duration: 4000,
      })
      // Give the toast a moment to show before redirecting
      setTimeout(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        router.push("/intern/history")
      }, 2500)
      return
    }
    toast.error(`Violation: ${type.replace(/_/g, " ")}`, {
      description: `${newCount} violation(s) recorded. Exam will be terminated at ${maxViolations}.`,
    })
  }, [router, maxViolations])

  const { isFullscreen, requestFullscreen } = useExamProctor({
    attemptId,
    currentViolations: violations,
    onViolation: handleViolation,
    enabled: true,
  })

  const handleEnterFullscreen = useCallback(async () => {
    const ok = await requestFullscreen()
    if (!ok) {
      setFullscreenError("Browser blocked fullscreen. Click again or allow it in your browser settings.")
    } else {
      setFullscreenError(null)
    }
  }, [requestFullscreen])

  // ── Answer selection ──────────────────────────────────────────────────────
  const handleSelectOption = useCallback(async (optionId: string) => {
    const question = questions[currentIndex]
    if (!question) return

    setAnswers(prev => ({ ...prev, [question.id]: optionId }))

    try {
      const res = await fetch(`/api/attempt/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedOptionId: optionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to save answer. Try again.")
      }
    } catch {
      toast.error("Failed to save answer. Check your connection.")
    }
  }, [attemptId, currentIndex, questions])

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!questions.length) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="size-12 text-yellow-500 mx-auto" />
          <h2 className="text-xl font-bold">No Questions Found</h2>
          <p className="text-muted-foreground">This quiz has no questions. Contact your administrator.</p>
          <Button onClick={() => router.push("/intern/quizzes")}>Go Back</Button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col select-none">

      {/* ── Fullscreen overlay ── */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-lg space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Maximize2 className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Fullscreen Required</h1>
                <p className="text-sm text-muted-foreground">
                  This exam must be taken in fullscreen mode. <strong>Your progress is saved.</strong>
                </p>
              </div>
            </div>
            {fullscreenError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {fullscreenError}
              </p>
            )}
            <Button className="w-full" size="lg" onClick={handleEnterFullscreen}>
              <Maximize2 className="mr-2 size-4" />
              Enter Fullscreen & Continue
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Timer is still running. Exiting fullscreen is recorded as a violation.
            </p>
          </div>
        </div>
      )}

      {/* ── Main exam UI (blurred when not fullscreen) ── */}
      <div className={cn(
        "flex min-h-screen flex-col",
        !isFullscreen && "pointer-events-none select-none blur-sm brightness-75"
      )}>

        {/* Top bar */}
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="flex items-center justify-between h-14 px-4">
            <span className="text-sm font-medium truncate max-w-[200px]">{quizTitle}</span>
            <TimerBar timeRemaining={timeRemaining} totalTime={timeLimitMinutes * 60} />
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Q {currentIndex + 1} / {questions.length}
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

        {/* Question */}
        <main className="flex-1 flex items-center justify-center py-8 px-4">
          <div className="w-full max-w-2xl">
            <QuestionCard
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
              text={currentQuestion.text}
              type={currentQuestion.type}
              points={currentQuestion.points}
              options={currentQuestion.options}
              selectedOptionId={answers[currentQuestion.id] ?? null}
              onSelectOption={handleSelectOption}
            />
          </div>
        </main>

        {/* Bottom bar */}
        <footer className="sticky bottom-0 border-t bg-background">
          <div className="flex items-center justify-between h-16 px-4">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-2 size-4" /> Previous
            </Button>

            {/* Dot navigation */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[50%]">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "size-2.5 rounded-full transition-colors",
                    idx === currentIndex
                      ? "bg-primary"
                      : answers[q.id]
                      ? "bg-primary/50"
                      : "bg-muted-foreground/30"
                  )}
                  aria-label={`Go to question ${idx + 1}`}
                />
              ))}
            </div>

            {isLastQuestion ? (
              <Button onClick={() => setShowSubmitDialog(true)} disabled={isSubmitting}>
                Submit Exam
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
              >
                Next <ChevronRight className="ml-2 size-4" />
              </Button>
            )}
          </div>
        </footer>
      </div>

      {/* ── Submit dialog ── */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                  {questions.length - answeredCount} question(s) unanswered.
                </span>
              )}
              <span className="block mt-2">This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitAttempt(false)}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <><Loader2 className="mr-2 size-4 animate-spin" /> Submitting...</>
                : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
