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
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Maximize2,
  Loader2,
  CheckCircle2,
  Circle,
  Send,
  Bookmark,
  BookmarkCheck,
  Eye,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react"
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

  const [currentIndex, setCurrentIndex]       = useState(0)
  const [answers, setAnswers]                 = useState<Record<string, string>>(existingAnswers)
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set())
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(
    new Set([questions[0]?.id ?? "", ...Object.keys(existingAnswers ?? {})].filter(Boolean))
  )
  const [violations, setViolations]             = useState(initialViolations)
  const [timeRemaining, setTimeRemaining]       = useState(initialSeconds)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting]         = useState(false)
  const [fullscreenError, setFullscreenError]   = useState<string | null>(null)
  const [hasAcceptedMonitoring, setHasAcceptedMonitoring] = useState(false)
  // Sidebar visible by default on wide screens, hidden on narrow
  const [sidebarOpen, setSidebarOpen]           = useState(true)
  const isSubmittingRef = useRef(false)

  // ── Submit ─────────────────────────────────────────────────────────────────
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

  // ── Timer ──────────────────────────────────────────────────────────────────
  useTimer({
    initialSeconds,
    onTick: setTimeRemaining,
    onExpire: () => submitAttempt(true, "TIMED_OUT"),
  })

  // ── Proctoring ─────────────────────────────────────────────────────────────
  const handleViolation = useCallback((type: ViolationType, newCount: number) => {
    setViolations(newCount)
    const label = type.replace(/_/g, " ").toLowerCase()
    toast.warning(`Violation: ${label}`, {
      description: `${newCount} violation${newCount !== 1 ? "s" : ""} recorded.`,
      duration: 3000,
    })
  }, [])

  const { isFullscreen, requestFullscreen } = useExamProctor({
    attemptId,
    initialViolations,
    onViolation: handleViolation,
    enabled: hasAcceptedMonitoring,
  })

  const handleEnterFullscreen = useCallback(async () => {
    setFullscreenError(null)
    const ok = await requestFullscreen()
    if (!ok) setFullscreenError("Browser blocked fullscreen. Click again or check your browser settings.")
  }, [requestFullscreen])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigateTo = useCallback((idx: number) => {
    setCurrentIndex(idx)
    const q = questions[idx]
    if (q) setVisitedQuestions(prev => new Set(prev).add(q.id))
  }, [questions])

  // ── Mark for review ────────────────────────────────────────────────────────
  const toggleReview = useCallback(() => {
    const qId = questions[currentIndex]?.id
    if (!qId) return
    setMarkedForReview(prev => {
      const next = new Set(prev)
      if (next.has(qId)) { next.delete(qId); toast.info("Removed from review list") }
      else               { next.add(qId);    toast.info("Marked for review") }
      return next
    })
  }, [currentIndex, questions])

  // ── Answer saving ──────────────────────────────────────────────────────────
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

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!questions.length) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-4">
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
  const answeredCount   = Object.keys(answers).length
  const reviewCount     = markedForReview.size
  const isLastQuestion  = currentIndex === questions.length - 1
  const isMarked        = markedForReview.has(currentQuestion?.id ?? "")

  return (
    <div className="dark h-screen bg-background text-foreground flex flex-col select-none overflow-hidden">

      {/* ── Red recording border ── */}
      {isFullscreen && hasAcceptedMonitoring && (
        <div className="fixed inset-0 pointer-events-none z-[100]">
          <div className="absolute inset-0 border-[3px] border-red-500/60" />
        </div>
      )}

      {/* ── Monitoring disclaimer ── */}
      {!hasAcceptedMonitoring && (
        <MonitoringDisclaimer onAccept={() => setHasAcceptedMonitoring(true)} />
      )}

      {/* ── Fullscreen required overlay ── */}
      {!isFullscreen && hasAcceptedMonitoring && (
        <div className="fixed inset-0 z-[49] flex items-center justify-center bg-background/95 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-xl space-y-5 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3.5 text-primary">
                <Maximize2 className="size-7" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Fullscreen Required</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                This exam runs in fullscreen. Your progress is saved.
              </p>
            </div>
            {fullscreenError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive text-left">
                {fullscreenError}
              </p>
            )}
            <Button className="w-full" onClick={handleEnterFullscreen}>
              <Maximize2 className="mr-2 size-4" />
              Enter Fullscreen &amp; Continue
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Exiting fullscreen is recorded as a violation. Timer is still running.
            </p>
          </div>
        </div>
      )}

      {/* ── Top header ── */}
      <header className="shrink-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center h-12 px-3 gap-2">

          {/* Quiz title */}
          <span className="text-sm font-semibold truncate min-w-0 flex-1 leading-tight">
            {quizTitle}
          </span>

          {/* Timer — always visible, no min-width constraint */}
          <div className="shrink-0">
            <TimerBar timeRemaining={timeRemaining} totalTime={timeLimitMinutes * 60} />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isFullscreen && hasAcceptedMonitoring && (
              <span className="flex items-center gap-1 bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                <span className="size-1.5 bg-white rounded-full animate-ping" />
                REC
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
              {answeredCount}/{questions.length}
            </span>
            {violations > 0 && (
              <Badge variant="destructive" className="gap-1 h-6 px-1.5 text-[11px]">
                <AlertTriangle className="size-3" />
                {violations}
              </Badge>
            )}
            {/* Sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? "Hide palette" : "Show palette"}
            >
              {sidebarOpen
                ? <PanelRightClose className="size-4" />
                : <PanelRightOpen className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className={cn(
        "flex flex-1 min-h-0",
        !isFullscreen && hasAcceptedMonitoring && "pointer-events-none select-none blur-sm brightness-50"
      )}>

        {/* ── Question area ── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Scrollable content — clamp width so text lines don't get too long */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex justify-center py-5 px-4">
              <div className="w-full max-w-2xl space-y-3">
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

                {/* Mark for Review */}
                <div className="flex justify-end pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleReview}
                    className={cn(
                      "gap-1.5 text-xs h-8 transition-colors",
                      isMarked
                        ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isMarked
                      ? <><BookmarkCheck className="size-3.5" /> Marked for Review</>
                      : <><Bookmark className="size-3.5" /> Mark for Review</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom nav bar ── */}
          <div className="shrink-0 border-t bg-background px-3 h-12 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-3"
              onClick={() => navigateTo(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-1 size-3.5" /> Prev
            </Button>

            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {currentIndex + 1} / {questions.length}
            </span>

            {isLastQuestion ? (
              <Button
                size="sm"
                className="h-8 text-xs px-3 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
              >
                <Send className="mr-1.5 size-3" /> Submit
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => navigateTo(Math.min(questions.length - 1, currentIndex + 1))}
              >
                Next <ChevronRight className="ml-1 size-3.5" />
              </Button>
            )}
          </div>
        </main>

        {/* ── Sidebar — collapsible ── */}
        {sidebarOpen && (
          <aside className="w-52 xl:w-60 shrink-0 border-l bg-background flex flex-col min-h-0">

            {/* Palette header */}
            <div className="shrink-0 px-3 py-2 border-b">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Question Palette
              </p>
            </div>

            {/* Progress row */}
            <div className="shrink-0 px-3 py-2 border-b space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="size-3" /> Answered
                </span>
                <span className="font-semibold tabular-nums">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Circle className="size-3" /> Unanswered
                </span>
                <span className="font-semibold tabular-nums text-muted-foreground">
                  {questions.length - answeredCount}
                </span>
              </div>
              {reviewCount > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Bookmark className="size-3" /> Review
                  </span>
                  <span className="font-semibold tabular-nums text-yellow-400">{reviewCount}</span>
                </div>
              )}
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question grid */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id]
                  const isReview   = markedForReview.has(q.id)
                  const isVisited  = visitedQuestions.has(q.id)
                  const isCurrent  = idx === currentIndex

                  let stateLabel = "Not visited"
                  if (isAnswered && isReview) stateLabel = "Answered & for review"
                  else if (isAnswered)        stateLabel = "Answered"
                  else if (isReview)          stateLabel = "For review"
                  else if (isVisited)         stateLabel = "Visited, unanswered"

                  return (
                    <button
                      key={q.id}
                      onClick={() => navigateTo(idx)}
                      title={`Q${idx + 1}: ${stateLabel}`}
                      className={cn(
                        "relative h-7 w-full rounded text-[11px] font-semibold transition-all duration-100",
                        "border focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                        isAnswered && isReview && !isCurrent && "bg-purple-600/20 border-purple-500/50 text-purple-300 hover:bg-purple-600/30",
                        isAnswered && isReview && isCurrent  && "bg-purple-600/30 border-purple-400 text-purple-200",
                        isAnswered && !isReview && !isCurrent && "bg-green-600/20 border-green-600/40 text-green-400 hover:bg-green-600/30",
                        isAnswered && !isReview && isCurrent  && "bg-green-600/30 border-green-500 text-green-300",
                        !isAnswered && isReview && !isCurrent && "bg-yellow-500/15 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/25",
                        !isAnswered && isReview && isCurrent  && "bg-yellow-500/25 border-yellow-400 text-yellow-300",
                        !isAnswered && !isReview && isVisited && !isCurrent && "bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20",
                        !isAnswered && !isReview && isVisited && isCurrent  && "bg-primary/10 border-primary/50 text-primary",
                        !isAnswered && !isReview && !isVisited && !isCurrent && "bg-muted/40 border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        !isAnswered && !isReview && !isVisited && isCurrent  && "bg-primary/10 border-primary/50 text-primary",
                      )}
                    >
                      {idx + 1}
                      {isAnswered && !isReview && <span className="absolute top-0.5 right-0.5 size-1 rounded-full bg-green-500" />}
                      {isReview && !isAnswered  && <span className="absolute top-0.5 right-0.5 size-1 rounded-full bg-yellow-400" />}
                      {isReview && isAnswered   && <span className="absolute top-0.5 right-0.5 size-1 rounded-full bg-purple-400" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Legend — compact */}
            <div className="shrink-0 px-3 py-1.5 border-t">
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {[
                  { color: "bg-green-600/20 border-green-600/40",   label: "Answered" },
                  { color: "bg-yellow-500/15 border-yellow-500/50", label: "Review" },
                  { color: "bg-purple-600/20 border-purple-500/50", label: "Ans + review" },
                  { color: "bg-orange-500/10 border-orange-500/30", label: "Visited" },
                  { color: "bg-muted/40 border-border",             label: "Not visited" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={cn("size-2 rounded-sm border shrink-0", color)} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <div className="shrink-0 p-2.5 border-t">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
              >
                <Send className="mr-1.5 size-3" /> Submit Exam
              </Button>
              {answeredCount < questions.length && (
                <p className="text-[10px] text-center text-muted-foreground mt-1">
                  {questions.length - answeredCount} unanswered
                </p>
              )}
            </div>

            {/* Camera — collapsible when not enough space */}
            <CameraMonitor isActive={isFullscreen && hasAcceptedMonitoring} />
          </aside>
        )}
      </div>

      {/* ── Submit dialog ── */}
      {showSubmitDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <Send className="size-4 text-green-500" />
              </div>
              <h2 className="text-base font-semibold">Submit Exam?</h2>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-green-500">
                  <CheckCircle2 className="size-3.5" /> Answered
                </span>
                <span className="font-semibold">{answeredCount}</span>
              </div>
              {reviewCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-yellow-400">
                    <Bookmark className="size-3.5" /> For review
                  </span>
                  <span className="font-semibold text-yellow-400">{reviewCount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Circle className="size-3.5" /> Not answered
                </span>
                <span className="font-semibold text-muted-foreground">
                  {questions.length - answeredCount}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {answeredCount < questions.length && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠ {questions.length - answeredCount} unanswered question{questions.length - answeredCount !== 1 ? "s" : ""} will score 0.
              </p>
            )}
            {reviewCount > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                <Eye className="inline size-3 mr-1" />
                {reviewCount} question{reviewCount !== 1 ? "s" : ""} still marked for review.
              </p>
            )}
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowSubmitDialog(false)} disabled={isSubmitting}>
                Go Back
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => submitAttempt(false)}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Submitting...</>
                  : <><Send className="mr-1.5 size-3.5" /> Confirm Submit</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
