import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Trophy,
  Target,
  Timer,
  Hash,
  FileQuestion,
  Lock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  BookOpen,
} from "lucide-react"
import { LocalTime } from "@/components/ui/local-time"

async function getAttemptResult(attemptId: string, internId: string) {
  const [attempt] = await sql`
    SELECT
      qa.*,
      qa."aiFeedback",
      q.title          AS quiz_title,
      q."passingScore" AS passing_score,
      q."resultsPublishedAt" AS results_published_at
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa.id        = ${attemptId}
    AND   qa."internId" = ${internId}
    AND   qa.status   != 'IN_PROGRESS'
  `
  if (!attempt) return null

  // Block access if results not published
  if (!attempt.results_published_at) return { attempt, blocked: true, questions: [], options: [] }

  // Questions with intern's answer
  const questions = await sql`
    SELECT
      q.id            AS question_id,
      q.text          AS question_text,
      q.points        AS question_points,
      q."order"       AS question_order,
      a."selectedOptionId",
      a."isCorrect"   AS answer_correct
    FROM questions q
    LEFT JOIN answers a ON a."questionId" = q.id AND a."attemptId" = ${attemptId}
    WHERE q."quizId" = ${attempt.quizId}
    ORDER BY q."order" ASC
  `

  const questionIds = questions.map((q) => q.question_id as string)
  const options = questionIds.length > 0
    ? await sql`
        SELECT id, "questionId", text, "isCorrect", "order"
        FROM options
        WHERE "questionId" = ANY(${questionIds}::text[])
        ORDER BY "questionId", "order" ASC
      `
    : []

  return { attempt, blocked: false, questions, options }
}

export default async function InternResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { attemptId } = await params
  const data = await getAttemptResult(attemptId, session.user.id)
  if (!data) notFound()

  const { attempt, blocked, questions, options } = data

  // Results not published yet
  if (blocked) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/intern/history"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">{attempt.quiz_title as string}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Lock className="size-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Results Not Published Yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Your admin hasn&apos;t published the results for this quiz yet.
              Check back later to see your score and question analysis.
            </p>
            <Button variant="outline" asChild>
              <Link href="/intern/history">Back to History</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Group options by questionId
  const optionsByQuestion = options.reduce<Record<string, typeof options>>(
    (acc, opt) => {
      const qid = opt.questionId as string
      if (!acc[qid]) acc[qid] = []
      acc[qid].push(opt)
      return acc
    },
    {}
  )

  const pct          = Number(attempt.percentage) || 0
  const passingScore = Number(attempt.passing_score)
  const correctCount = questions.filter((q) => q.answer_correct === true).length
  const totalQ       = questions.length
  const timeSpent    = Number(attempt.timeSpentSeconds) || 0

  // Parse aiFeedback — Neon returns jsonb as an object already
  type AiFeedback = {
    overall_summary?: string
    performance_level?: string
    strengths?: string[]
    improvements?: string[]
    wrong_questions?: { question: string; intern_answer: string; correct_answer: string; tip: string }[]
    time_assessment?: string
    recommended_topics?: string[]
    encouragement?: string
  }
  const feedback: AiFeedback | null = attempt.aiFeedback
    ? (typeof attempt.aiFeedback === "string" ? JSON.parse(attempt.aiFeedback) : attempt.aiFeedback) as AiFeedback
    : null

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/intern/history"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold leading-tight">{attempt.quiz_title as string}</h1>
          <p className="text-sm text-muted-foreground">
            <LocalTime date={attempt.startedAt as string} fmt="MMMM d, yyyy 'at' h:mm a" />
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Target className="size-4" /> Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(pct)}%</div>
            <p className="text-sm text-muted-foreground">{attempt.score ?? "—"} / {attempt.totalPoints ?? "—"} pts</p>
            <Progress
              value={pct}
              className={`mt-2 h-2 ${attempt.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
            />
            <div className="relative mt-0" style={{ marginTop: "-8px" }}>
              <div
                className="absolute top-0 h-2 w-0.5 bg-foreground/40"
                style={{ left: `${passingScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Passing: {passingScore}%</p>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <FileQuestion className="size-4" /> Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {attempt.passed
                ? <CheckCircle className="size-6 text-green-500" />
                : <XCircle className="size-6 text-red-500" />}
              <span className={`text-2xl font-bold ${attempt.passed ? "text-green-600" : "text-red-500"}`}>
                {attempt.passed ? "Passed" : "Failed"}
              </span>
            </div>
            {attempt.rank && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Trophy className="size-3.5" /> Rank #{attempt.rank as number}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Hash className="size-4" /> Correct
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {correctCount}
              <span className="text-lg font-normal text-muted-foreground"> / {totalQ}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalQ - correctCount} wrong
            </p>
          </CardContent>
        </Card>

        {/* Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Timer className="size-4" /> Time Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.floor(timeSpent / 60)}m
              <span className="text-lg font-normal text-muted-foreground"> {timeSpent % 60}s</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-purple-500" />
              AI Performance Feedback
              {feedback.performance_level && (
                <Badge className={`ml-auto text-xs ${
                  feedback.performance_level === "Excellent" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                  feedback.performance_level === "Good"      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                  feedback.performance_level === "Average"   ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                  "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}>
                  {feedback.performance_level}
                </Badge>
              )}
            </CardTitle>
            {feedback.overall_summary && (
              <CardDescription className="text-sm text-foreground/80 leading-relaxed">
                {feedback.overall_summary}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Strengths + Improvements */}
            <div className="grid sm:grid-cols-2 gap-4">
              {feedback.strengths && feedback.strengths.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5 uppercase tracking-wide">
                    <TrendingUp className="size-3.5" /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="size-3.5 text-green-500 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.improvements && feedback.improvements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5 uppercase tracking-wide">
                    <TrendingDown className="size-3.5" /> Areas to Improve
                  </p>
                  <ul className="space-y-1">
                    {feedback.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="size-3.5 text-orange-500 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Wrong questions with tips */}
            {feedback.wrong_questions && feedback.wrong_questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <Lightbulb className="size-3.5" /> Question Tips
                </p>
                <div className="space-y-2">
                  {feedback.wrong_questions.map((wq, i) => (
                    <div key={i} className="rounded-lg border bg-background p-3 space-y-1.5">
                      <p className="text-sm font-medium leading-snug">{wq.question}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="text-red-600 dark:text-red-400">
                          Your answer: <span className="font-medium">{wq.intern_answer}</span>
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          Correct: <span className="font-medium">{wq.correct_answer}</span>
                        </span>
                      </div>
                      {wq.tip && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                          💡 {wq.tip}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended topics */}
            {feedback.recommended_topics && feedback.recommended_topics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <BookOpen className="size-3.5" /> Recommended Topics to Study
                </p>
                <div className="flex flex-wrap gap-2">
                  {feedback.recommended_topics.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Time + encouragement */}
            <div className="space-y-2 pt-1 border-t">
              {feedback.time_assessment && (
                <p className="text-sm text-muted-foreground">
                  ⏱ {feedback.time_assessment}
                </p>
              )}
              {feedback.encouragement && (
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  ✨ {feedback.encouragement}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question-by-question analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="size-5" /> Question Analysis
          </CardTitle>
          <CardDescription>
            Review every question — see what you got right and wrong
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, idx) => {
            const qOptions   = optionsByQuestion[q.question_id as string] ?? []
            const selectedId = q.selectedOptionId as string | null
            const isCorrect  = q.answer_correct as boolean | null

            return (
              <div
                key={q.question_id as string}
                className={`rounded-xl border p-4 space-y-3 ${
                  isCorrect === true
                    ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                    : isCorrect === false
                    ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                    : "border-border"
                }`}
              >
                {/* Question header */}
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center size-7 rounded-full text-sm font-bold shrink-0 mt-0.5 ${
                    isCorrect === true
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : isCorrect === false
                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug">{q.question_text as string}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{q.question_points as number} pt{Number(q.question_points) !== 1 ? "s" : ""}</span>
                      {isCorrect === true && (
                        <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle className="mr-1 size-3" /> +{q.question_points as number} pts
                        </Badge>
                      )}
                      {isCorrect === false && (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="mr-1 size-3" /> 0 pts
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2 ml-10">
                  {qOptions.map((opt) => {
                    const isSelected   = opt.id === selectedId
                    const isCorrectOpt = opt.isCorrect as boolean

                    let cls = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm border"

                    if (isSelected && isCorrectOpt) {
                      cls += " bg-green-100 border-green-400 text-green-800 dark:bg-green-950/50 dark:border-green-700 dark:text-green-200"
                    } else if (isSelected && !isCorrectOpt) {
                      cls += " bg-red-100 border-red-400 text-red-800 dark:bg-red-950/50 dark:border-red-700 dark:text-red-200"
                    } else if (!isSelected && isCorrectOpt) {
                      cls += " bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400"
                    } else {
                      cls += " bg-background border-border text-muted-foreground"
                    }

                    return (
                      <div key={opt.id as string} className={cls}>
                        {/* Icon */}
                        <span className="shrink-0">
                          {isSelected && isCorrectOpt && <CheckCircle className="size-4 text-green-600" />}
                          {isSelected && !isCorrectOpt && <XCircle className="size-4 text-red-500" />}
                          {!isSelected && isCorrectOpt && <CheckCircle className="size-4 text-green-500 opacity-60" />}
                          {!isSelected && !isCorrectOpt && (
                            <span className="size-4 rounded-full border border-muted-foreground/30 inline-block" />
                          )}
                        </span>

                        <span className="flex-1 leading-snug">{opt.text as string}</span>

                        {/* Labels */}
                        {isSelected && isCorrectOpt && (
                          <span className="text-xs font-medium text-green-700 dark:text-green-400 shrink-0">Your answer ✓</span>
                        )}
                        {isSelected && !isCorrectOpt && (
                          <span className="text-xs font-medium text-red-600 dark:text-red-400 shrink-0">Your answer ✗</span>
                        )}
                        {!isSelected && isCorrectOpt && (
                          <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0 opacity-70">Correct answer</span>
                        )}
                      </div>
                    )
                  })}

                  {/* No answer */}
                  {!selectedId && (
                    <p className="text-sm text-muted-foreground italic px-3">No answer selected</p>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
