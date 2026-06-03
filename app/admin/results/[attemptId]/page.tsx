import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft, User, FileQuestion, Clock, Target, AlertTriangle,
  CheckCircle, XCircle, Pencil, ShieldAlert, Hash, Calendar, Timer,
} from "lucide-react"
import { LocalTime } from "@/components/ui/local-time"
import { TerminateAttemptButton } from "./terminate-button"
import { ScoreOverrideForm } from "./score-override-form"
import { AiFeedbackPanel } from "./ai-feedback-panel"

async function getAttemptDetails(attemptId: string) {
  const [attempt] = await sql`
    SELECT
      qa.*,
      qa."aiFeedback",
      u.name  AS intern_name,
      u.email AS intern_email,
      q.title AS quiz_title,
      q.description AS quiz_description,
      q."passingScore"     AS passing_score,
      q."timeLimitMinutes" AS time_limit
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa.id = ${attemptId}
  `
  if (!attempt) return null

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

  const violations = await sql`
    SELECT * FROM violations WHERE "attemptId" = ${attemptId} ORDER BY timestamp ASC
  `

  return { attempt, questions, options, violations }
}

const violationLabels: Record<string, string> = {
  TAB_SWITCH: "Tab Switch",
  FULLSCREEN_EXIT: "Exited Fullscreen",
  COPY_ATTEMPT: "Copy Attempt",
  PASTE_ATTEMPT: "Paste Attempt",
  RIGHT_CLICK: "Right Click",
  DEVTOOLS_OPEN: "DevTools Opened",
  WINDOW_BLUR: "Cursor Left Window",
  CONTEXT_MENU: "Context Menu",
}

export default async function AttemptDetailsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")

  const { attemptId } = await params
  const data = await getAttemptDetails(attemptId)
  if (!data) notFound()

  const { attempt, questions, options, violations } = data

  const optionsByQuestion = options.reduce<Record<string, typeof options>>(
    (acc, opt) => {
      const qid = opt.questionId as string
      if (!acc[qid]) acc[qid] = []
      acc[qid].push(opt)
      return acc
    },
    {}
  )

  const isFinalized    = attempt.status !== "IN_PROGRESS"
  const correctCount   = questions.filter((q) => q.answer_correct === true).length
  const totalQuestions = questions.length
  const percentage     = Number(attempt.percentage) || 0
  const hasFeedback    = !!(attempt as Record<string, unknown>).aiFeedback

  return (
    <div className="space-y-6">

      {/* ── Back + title ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/results"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{attempt.quiz_title as string}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <User className="size-3.5" />
            {attempt.intern_name as string}
            <span className="text-muted-foreground/60">·</span>
            {attempt.intern_email as string}
          </p>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Target className="size-4" /> Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{Math.round(percentage)}%</span>
              {attempt.scoreOverriddenAt && (
                <Badge variant="secondary" className="mb-1 gap-1 text-xs">
                  <Pencil className="size-3" /> Adjusted
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {attempt.score ?? "—"} / {attempt.totalPoints ?? "—"} pts
            </p>
            <Progress
              value={percentage}
              className={`mt-2 h-2 ${attempt.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <FileQuestion className="size-4" /> Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFinalized ? (
              <>
                <div className="flex items-center gap-2">
                  {attempt.passed
                    ? <CheckCircle className="size-6 text-green-500" />
                    : <XCircle className="size-6 text-red-500" />}
                  <span className={`text-2xl font-bold ${attempt.passed ? "text-green-600" : "text-red-500"}`}>
                    {attempt.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Passing threshold: {attempt.passing_score as number}%
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-muted-foreground" />
                <span className="text-lg font-semibold text-muted-foreground">In Progress</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Hash className="size-4" /> Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isFinalized ? correctCount : "—"}
              <span className="text-lg font-normal text-muted-foreground"> / {totalQuestions}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">correct answers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Timer className="size-4" /> Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {attempt.timeSpentSeconds
                ? `${Math.floor(Number(attempt.timeSpentSeconds) / 60)}m`
                : "—"}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {attempt.timeSpentSeconds
                ? `${Number(attempt.timeSpentSeconds) % 60}s · limit ${attempt.time_limit as number}m`
                : "not yet submitted"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Meta row ── */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          Started <LocalTime date={attempt.startedAt as string} fmt="MMM d, yyyy 'at' h:mm a" />
        </span>
        {attempt.submittedAt && (
          <span className="flex items-center gap-1.5">
            <CheckCircle className="size-3.5" />
            Submitted <LocalTime date={attempt.submittedAt as string} fmt="MMM d, yyyy 'at' h:mm a" />
          </span>
        )}
        {attempt.scoreOverriddenAt && (
          <span className="flex items-center gap-1.5">
            <Pencil className="size-3.5" />
            Score adjusted <LocalTime date={attempt.scoreOverriddenAt as string} fmt="MMM d, yyyy 'at' h:mm a" />
          </span>
        )}
        <Badge variant={
          attempt.status === "IN_PROGRESS" ? "secondary" :
          attempt.status === "SUBMITTED"   ? "outline" : "destructive"
        }>
          {attempt.status as string}
        </Badge>
      </div>

      {/* ── Question analysis ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="size-5" /> Question Analysis
          </CardTitle>
          <CardDescription>All answer options shown — intern&apos;s selection highlighted</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-6">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-[340px]">Options</TableHead>
                <TableHead className="text-right w-20">Points</TableHead>
                <TableHead className="text-right w-24 pr-6">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q, idx) => {
                const qOptions   = optionsByQuestion[q.question_id as string] ?? []
                const selectedId = q.selectedOptionId as string | null
                const isCorrect  = q.answer_correct as boolean | null

                return (
                  <TableRow key={q.question_id as string} className="align-top">
                    <TableCell className="pl-6 pt-4 text-muted-foreground font-mono text-sm">{idx + 1}</TableCell>
                    <TableCell className="pt-4 max-w-xs">
                      <p className="font-medium leading-snug">{q.question_text as string}</p>
                    </TableCell>
                    <TableCell className="pt-3">
                      <div className="space-y-1.5">
                        {qOptions.map((opt) => {
                          const isSelected   = opt.id === selectedId
                          const isCorrectOpt = opt.isCorrect as boolean
                          let rowClass = "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
                          let indicator = null

                          if (isSelected && isCorrectOpt) {
                            rowClass += " bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200"
                            indicator = <CheckCircle className="size-3.5 mt-0.5 shrink-0 text-green-600" />
                          } else if (isSelected && !isCorrectOpt) {
                            rowClass += " bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
                            indicator = <XCircle className="size-3.5 mt-0.5 shrink-0 text-red-500" />
                          } else if (!isSelected && isCorrectOpt) {
                            rowClass += " bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-300"
                            indicator = <CheckCircle className="size-3.5 mt-0.5 shrink-0 text-green-500 opacity-60" />
                          } else {
                            rowClass += " text-muted-foreground"
                            indicator = <span className="size-3.5 mt-0.5 shrink-0 rounded-full border border-muted-foreground/30 inline-block" />
                          }

                          return (
                            <div key={opt.id as string} className={rowClass}>
                              {indicator}
                              <span className="leading-snug">{opt.text as string}</span>
                              {isSelected && (
                                <Badge variant="outline" className={`ml-auto shrink-0 text-xs ${
                                  isCorrectOpt
                                    ? "border-green-400 text-green-700 dark:text-green-300"
                                    : "border-red-400 text-red-700 dark:text-red-300"
                                }`}>Selected</Badge>
                              )}
                              {!isSelected && isCorrectOpt && (
                                <Badge variant="outline" className="ml-auto shrink-0 text-xs border-green-400/50 text-green-600 dark:text-green-400 opacity-70">
                                  Correct
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                        {qOptions.length === 0 && (
                          <span className="text-sm text-muted-foreground italic">No options found</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pt-4 font-mono text-sm">
                      {isFinalized ? (
                        <span className={isCorrect ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                          {isCorrect ? `+${q.question_points as number}` : "0"}
                          <span className="text-muted-foreground font-normal">/{q.question_points as number}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{q.question_points as number}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pt-4 pr-6">
                      {isFinalized ? (
                        isCorrect
                          ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"><CheckCircle className="mr-1 size-3" /> Correct</Badge>
                          : <Badge variant="destructive"><XCircle className="mr-1 size-3" /> Wrong</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Violations + Admin Controls ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" /> Violations
              {violations.length > 0 && <Badge variant="destructive" className="ml-auto">{violations.length}</Badge>}
            </CardTitle>
            <CardDescription>Proctoring events recorded during this attempt</CardDescription>
          </CardHeader>
          <CardContent>
            {violations.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 py-2">
                <CheckCircle className="size-4" /><span>No violations detected</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v) => (
                    <TableRow key={v.id as string}>
                      <TableCell className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-destructive" />
                        {violationLabels[v.type as string] ?? v.type as string}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        <LocalTime date={v.timestamp as string} fmt="h:mm:ss a" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5" /> Admin Controls
            </CardTitle>
            <CardDescription>Manage this attempt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TerminateAttemptButton attemptId={attemptId} status={attempt.status as string} />
            <ScoreOverrideForm
              attemptId={attemptId}
              status={attempt.status as string}
              totalPoints={Number(attempt.totalPoints) || 0}
              currentScore={attempt.score != null ? Number(attempt.score) : null}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── AI Feedback ── only for finalized attempts ── */}
      {isFinalized && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              ✨ AI Feedback
            </CardTitle>
            <CardDescription>
              Generate a prompt, paste it into Claude or ChatGPT, then save the response to show the intern personalised feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiFeedbackPanel
              attemptId={attemptId}
              hasFeedback={hasFeedback}
            />
          </CardContent>
        </Card>
      )}

    </div>
  )
}
