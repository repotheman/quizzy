import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  History,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Target,
  Timer,
  Calendar,
  ShieldAlert,
  ChevronRight,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

async function getAttemptHistory(internId: string) {
  return sql`
    SELECT
      qa.id,
      qa.status,
      qa.score,
      qa."totalPoints",
      qa.percentage,
      qa.passed,
      qa.rank,
      qa.violations,
      qa."autoSubmitted",
      qa."startedAt",
      qa."submittedAt",
      qa."timeSpentSeconds",
      q.title                                                        AS quiz_title,
      q."passingScore"                                               AS passing_score,
      q."resultsPublishedAt"                                         AS results_published_at,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id)   AS violation_count,
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id)        AS total_questions,
      (SELECT COUNT(*) FROM answers WHERE "attemptId" = qa.id AND "isCorrect" = true) AS correct_answers
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa."internId" = ${internId}
    AND   qa.status    != 'IN_PROGRESS'
    ORDER BY qa."startedAt" DESC
  `
}

function RankDisplay({ rank }: { rank: number | null }) {
  if (!rank) return null
  const medals: Record<number, { emoji: string; color: string }> = {
    1: { emoji: "🥇", color: "text-yellow-500" },
    2: { emoji: "🥈", color: "text-slate-400" },
    3: { emoji: "🥉", color: "text-amber-600" },
  }
  const medal = medals[rank]
  return (
    <div className="flex items-center gap-1">
      {medal ? (
        <span className={`text-lg font-bold ${medal.color}`}>{medal.emoji} #{rank}</span>
      ) : (
        <span className="flex items-center gap-1 font-mono font-semibold text-muted-foreground">
          <Trophy className="size-3.5" />#{rank}
        </span>
      )}
    </div>
  )
}

export default async function HistoryPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const attempts = await getAttemptHistory(session.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">Your past quiz attempts and results</p>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No history yet</h3>
            <p className="text-muted-foreground text-center">
              Your quiz attempts will appear here once you complete some quizzes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => {
            const resultsHidden   = !attempt.results_published_at
            const pct             = Number(attempt.percentage) || 0
            const passingScore    = Number(attempt.passing_score)
            const isTerminated    = attempt.status === "TERMINATED"
            const isTimedOut      = attempt.status === "TIMED_OUT"
            const isAbnormal      = isTerminated || isTimedOut
            const violationCount  = Number(attempt.violation_count)
            const correctAnswers  = Number(attempt.correct_answers)
            const totalQuestions  = Number(attempt.total_questions)
            const timeSpent       = Number(attempt.timeSpentSeconds)

            return (
              <Link
                key={attempt.id as string}
                href={`/intern/history/${attempt.id as string}`}
                className={`block group ${resultsHidden ? "pointer-events-none" : ""}`}
              >
              <Card
                className={`overflow-hidden transition-colors ${
                  !resultsHidden
                    ? "group-hover:shadow-md group-hover:border-primary/40 cursor-pointer"
                    : ""
                } ${
                  !resultsHidden && attempt.passed
                    ? "border-green-200 dark:border-green-900"
                    : !resultsHidden && !attempt.passed && !isAbnormal
                    ? "border-red-200 dark:border-red-900"
                    : isAbnormal
                    ? "border-destructive/30"
                    : ""
                }`}
              >
                {/* Colored top strip */}
                <div
                  className={`h-1 w-full ${
                    isAbnormal
                      ? "bg-destructive"
                      : resultsHidden
                      ? "bg-muted"
                      : attempt.passed
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />

                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                    {/* Left — quiz info + status */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg leading-tight truncate">
                          {attempt.quiz_title as string}
                        </h3>
                        {/* Status badge */}
                        {isTerminated ? (
                          <Badge variant="destructive">
                            <ShieldAlert className="mr-1 size-3" /> Terminated
                          </Badge>
                        ) : isTimedOut ? (
                          <Badge variant="destructive">
                            <Clock className="mr-1 size-3" /> Timed Out
                          </Badge>
                        ) : resultsHidden ? (
                          <Badge variant="outline">
                            <Clock className="mr-1 size-3" /> Results Pending
                          </Badge>
                        ) : attempt.passed ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle className="mr-1 size-3" /> Passed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            <XCircle className="mr-1 size-3" /> Failed
                          </Badge>
                        )}
                        {attempt.autoSubmitted && !isTerminated && (
                          <Badge variant="secondary" className="text-xs">Auto-submitted</Badge>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3.5" />
                          {format(new Date(attempt.startedAt as string), "MMM d, yyyy")}
                          <span className="text-muted-foreground/60">·</span>
                          {formatDistanceToNow(new Date(attempt.startedAt as string), { addSuffix: true })}
                        </span>
                        {timeSpent > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer className="size-3.5" />
                            {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
                          </span>
                        )}
                        {violationCount > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="size-3.5" />
                            {violationCount} violation{violationCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right — score display */}
                    <div className="flex items-center gap-6 shrink-0">

                      {/* Questions correct */}
                      {!isAbnormal && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-0.5">Questions</p>
                          <p className="text-xl font-bold">
                            {correctAnswers}
                            <span className="text-sm font-normal text-muted-foreground">/{totalQuestions}</span>
                          </p>
                        </div>
                      )}

                      {/* Rank */}
                      {!resultsHidden && attempt.rank && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-0.5">Rank</p>
                          <RankDisplay rank={attempt.rank as number} />
                        </div>
                      )}

                      {/* Score circle / hidden state */}
                      <div className="flex flex-col items-center gap-1">
                        {resultsHidden ? (
                          <div className="flex flex-col items-center justify-center size-20 rounded-full border-4 border-dashed border-muted-foreground/30">
                            <Clock className="size-5 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground/60 mt-0.5">Pending</span>
                          </div>
                        ) : isAbnormal ? (
                          <div className="flex flex-col items-center justify-center size-20 rounded-full border-4 border-destructive/30 bg-destructive/5">
                            <span className="text-lg font-bold text-destructive">
                              {Math.round(pct)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {attempt.score}/{attempt.totalPoints}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`flex flex-col items-center justify-center size-20 rounded-full border-4 ${
                              attempt.passed
                                ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                                : "border-red-400 bg-red-50 dark:bg-red-950/30"
                            }`}
                          >
                            <span
                              className={`text-xl font-bold ${
                                attempt.passed ? "text-green-600 dark:text-green-400" : "text-red-500"
                              }`}
                            >
                              {Math.round(pct)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {attempt.score}/{attempt.totalPoints}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score bar — only when results are visible and not abnormal */}
                  {!resultsHidden && !isAbnormal && (
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Score</span>
                        <span className="flex items-center gap-1">
                          <Target className="size-3" />
                          Passing: {passingScore}%
                        </span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={pct}
                          className={`h-2 ${
                            attempt.passed
                              ? "[&>div]:bg-green-500"
                              : "[&>div]:bg-red-500"
                          }`}
                        />
                        <div
                          className="absolute top-0 h-2 w-0.5 bg-foreground/40"
                          style={{ left: `${passingScore}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* View analysis CTA */}
                  {!resultsHidden && (
                    <div className="mt-3 flex items-center justify-end gap-1 text-xs text-primary font-medium">
                      View question analysis
                      <ChevronRight className="size-3.5" />
                    </div>
                  )}
                  {resultsHidden && (
                    <div className="mt-3 text-xs text-muted-foreground text-right">
                      Analysis available once results are published
                    </div>
                  )}
                </CardContent>
              </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
