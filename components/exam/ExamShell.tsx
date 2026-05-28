"use client"

import { useCallback, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useExamProctor, type ViolationType } from "@/hooks/useExamProctor"
import { useTimer } from "@/hooks/useTimer"
import { TimerBar } from "./TimerBar"
import { QuestionCard } from "./QuestionCard"
import { CameraMonitor } from "./CameraMonitor"
import { MonitoringDisclaimer } from "./MonitoringDisclaimer"
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

  const [currentIndex, setCurrentIndex]         = useState(0)
  const [answers, setAnswers]                   = useState<Record<string, string>>(existingAnswers)
  const [violations, setViolations]             = useState(initialViolations)
  const [timeRemaining, setTimeRemaining]       = useState(initialSeconds)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting]         = useState(false)
  const [fullscreenError, setFullscreenError]   = useState<string | null>(null)
  const [hasAcceptedMonitoring, setHasAcceptedMonitoring] = useState(false)
  const isSubmittingRef                         = useRef(false)

  // ── Submit ────────────────────────────────────────────────────────────────
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
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
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
  const handleViolation = useCallback((type: ViolationType, newCount: number) => {
    setViolations(newCount)
    const label = type.replace(/_/g, " ").toLowerCase()
    toast.warning(`Violation recorded: ${label}`, {
      description: `${newCount} violation${newCount !== 1 ? "s" : ""} logged so far.`,
      duration: 3000,
    })
  }, [])

  const { isFullscreen, requestFullscreen } = useExamProctor({
    attemptId,
    initialViolations: violations,
    onViolation: handleViolation,
    enabled: true,
  })

  const handleEnterFullscreen = useCallback(async () => {
    setFullscreenError(null)
    const ok = await requestFullscreen()
    if (!ok) {
      setFullscreenError("Browser blocked fullscreen. Click again or allow it in your browser settings.")
    }
  }, [requestFullscreen])

  // ── Answer saving ─────────────────────────────────────────────────────────
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

  // ── No questions guard ────────────────────────────────────────────────────
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
  const isLastQuestion  = currentIndex === questions.length - 1
  const answeredCount   = Object.keys(answers).length

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col select-none relative">

      {/* ── Screen Recording Border — red border around entire screen when in fullscreen ── */}
      {isFullscreen && hasAcceptedMonitoring && (
        <>
          {/* Red border */}
          <div className="fixed inset-0 pointer-events-none z-[100]">
            <div className="absolute inset-0 border-[4px] border-red-500 animate-pulse" />
          </div>
          
          {/* Screen Recording Indicator - Top Left */}
          <div className="fixed top-4 left-4 z-[100] flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse">
            <div className="size-2 bg-white rounded-full animate-ping" />
            <span className="text-xs font-bold">SCREEN RECORDING</span>
          </div>
        </>
      )}

      {/* ── Monitoring Disclaimer — shows first before exam starts ── */}
      {!hasAcceptedMonitoring && (
        <MonitoringDisclaimer onAccept={() => setHasAcceptedMonitoring(true)} />
      )}

      {/* ── Camera Monitor — always visible when in fullscreen ── */}
      <CameraMonitor isActive={isFullscreen && hasAcceptedMonitoring} />

      {/* ── Fullscreen overlay ── */}
      {!isFullscreen && hasAcceptedMonitoring && (
        <div className="fixed inset-0 z-[49] flex items-center justify-center bg-background/95 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl space-y-5 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <Maximize2 className="size-8" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Fullscreen Required</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This exam must be taken in fullscreen mode.
                <br />
                <strong className="text-foreground">Your progress is saved.</strong>
              </p>
            </div>
            {fullscreenError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive text-left">
                {fullscreenError}
              </p>
            )}
            <Button className="w-full" size="lg" onClick={handleEnterFullscreen}>
              <Maximize2 className="mr-2 size-4" />
              Enter Fullscreen &amp; Continue
            </Button>
            <p className="text-xs text-muted-foreground">
              Exiting fullscreen is recorded as a violation. Timer is still running.
            </p>
          </div>
        </div>
      )}

      {/* ── Top bar — always visible ── */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="flex items-center justify-between h-14 px-4 gap-4">
          <span className="text-sm font-medium truncate max-w-[180px] shrink-0">{quizTitle}</span>
          <TimerBar timeRemaining={timeRemaining} totalTime={timeLimitMinutes * 60} />
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {questions.length}
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

      {/* ── Question area — blurred when not in fullscreen ── */}
      <main className={cn(
        "flex-1 flex items-center justify-center py-8 px-4",
        !isFullscreen && "pointer-events-none select-none blur-sm brightness-50"
      )}>
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

      {/* ── Bottom bar — always interactive ── */}
      <footer className="sticky bottom-0 border-t bg-background">
        <div className="flex items-center justify-between h-16 px-4">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-2 size-4" /> Previous
          </Button>

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

      {/* ── Submit confirmation — rendered as a top-level fixed overlay ── */}
      {showSubmitDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold">Submit Exam?</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>You have answered {answeredCount} of {questions.length} questions.</p>
              {answeredCount < questions.length && (
                <p className="text-yellow-600 dark:text-yellow-400">
                  {questions.length - answeredCount} question(s) left unanswered.
                </p>
              )}
              <p>This cannot be undone.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSubmitDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => submitAttempt(false)}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <><Loader2 className="mr-2 size-4 animate-spin" /> Submitting...</>
                  : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
