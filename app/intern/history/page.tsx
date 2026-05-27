import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  History,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Timer,
  ChevronRight,
  Lock,
} from "lucide-react"
import { format } from "date-fns"

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
      qa."autoSubmitted",
      qa."startedAt",
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
              Complete a quiz to see your results here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Attempts</CardTitle>
            <CardDescription>{attempts.length} attempt{attempts.length !== 1 ? "s" : ""} recorded</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {attempts.map((attempt) => {
                const resultsHidden  = !attempt.results_published_at
                const pct            = Number(attempt.percentage) || 0
                const passingScore   = Number(attempt.passing_score)
                const isTerminated   = attempt.status === "TERMINATED"
                const isTimedOut     = attempt.status === "TIMED_OUT"
                const isAbnormal     = isTerminated || isTimedOut
                const violationCount = Number(attempt.violation_count)
                const correctAnswers = Number(attempt.correct_answers)
                const totalQuestions = Number(attempt.total_questions)
                const timeSpent      = Number(attempt.timeSpentSeconds)
                const canView        = !resultsHidden

                const row = (
                  <div className={`flex items-center gap-4 px-6 py-4 ${canView ? "hover:bg-muted/40 transition-colors cursor-pointer" : ""}`}>

                    {/* Left: title + meta */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{attempt.quiz_title as string}</span>
                        {isTerminated && <Badge variant="destructive" className="text-xs shrink-0">Terminated</Badge>}
                        {isTimedOut   && <Badge variant="destructive" className="text-xs shrink-0">Timed Out</Badge>}
                        {!isAbnormal && resultsHidden && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <Lock className="mr-1 size-3" />Pending
                          </Badge>
                        )}
                        {!isAbnormal && !resultsHidden && attempt.passed && (
                          <Badge className="text-xs shrink-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle className="mr-1 size-3" />Passed
                          </Badge>
                        )}
                        {!isAbnormal && !resultsHidden && !attempt.passed && (
                          <Badge className="text-xs shrink-0 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            <XCircle className="mr-1 size-3" />Failed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{format(new Date(attempt.startedAt as string), "MMM d, yyyy · h:mm a")}</span>
                        {timeSpent > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer className="size-3" />
                            {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
                          </span>
                        )}
                        {violationCount > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="size-3" />
                            {violationCount} violation{violationCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: score bar */}
                    <div className="hidden sm:flex flex-col gap-1 w-32 shrink-0">
                      {resultsHidden ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3.5" /> Results pending
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className={`font-semibold ${attempt.passed ? "text-green-600" : "text-red-500"}`}>
                              {Math.round(pct)}%
                            </span>
                            <span className="text-muted-foreground">{attempt.score}/{attempt.totalPoints}</span>
                          </div>
                          <div className="relative">
                            <Progress
                              value={pct}
                              className={`h-1.5 ${attempt.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                            />
                            <div
                              className="absolute top-0 h-1.5 w-px bg-foreground/40"
                              style={{ left: `${passingScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">pass at {passingScore}%</span>
                        </>
                      )}
                    </div>

                    {/* Right: questions + rank + arrow */}
                    <div className="flex items-center gap-4 shrink-0">
                      {!isAbnormal && (
                        <div className="text-center hidden md:block">
                          <p className="text-xs text-muted-foreground">Correct</p>
                          <p className="text-sm font-semibold">
                            {correctAnswers}<span className="text-muted-foreground font-normal">/{totalQuestions}</span>
                          </p>
                        </div>
                      )}
                      {!resultsHidden && attempt.rank && (
                        <div className="text-center hidden md:block">
                          <p className="text-xs text-muted-foreground">Rank</p>
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <Trophy className="size-3.5 text-yellow-500" />
                            #{attempt.rank as number}
                          </p>
                        </div>
                      )}
                      {canView ? (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      ) : (
                        <div className="size-4" />
                      )}
                    </div>
                  </div>
                )

                return canView ? (
                  <Link key={attempt.id as string} href={`/intern/history/${attempt.id as string}`}>
                    {row}
                  </Link>
                ) : (
                  <div key={attempt.id as string}>{row}</div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
