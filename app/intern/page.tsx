import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FileQuestion,
  Clock,
  CheckCircle,
  PlayCircle,
  Trophy,
  Medal,
  TrendingUp,
  Target,
  Zap,
  AlertTriangle,
} from "lucide-react"
import { format } from "date-fns"
import dynamic from "next/dynamic"
import { LocalTime } from "@/components/ui/local-time"

const InternScoreChart = dynamic(
  () => import("./intern-score-chart").then((mod) => mod.InternScoreChart)
)


// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getInternStats(internId: string) {
  const [row] = await sql`
    SELECT
      (SELECT COUNT(*) FROM quiz_assignments WHERE "internId" = ${internId})                                    AS assigned,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "internId" = ${internId} AND status != 'IN_PROGRESS')          AS completed,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "internId" = ${internId} AND status != 'IN_PROGRESS' AND passed = true) AS passed,
      (SELECT COALESCE(AVG(percentage), 0) FROM quiz_attempts WHERE "internId" = ${internId} AND status != 'IN_PROGRESS') AS avg_score,
      (SELECT COALESCE(MAX(percentage), 0) FROM quiz_attempts WHERE "internId" = ${internId} AND status != 'IN_PROGRESS') AS best_score,
      (SELECT COUNT(*) FROM violations v JOIN quiz_attempts qa ON qa.id = v."attemptId" WHERE qa."internId" = ${internId}) AS total_violations
  `
  return {
    assigned:         Number(row.assigned),
    completed:        Number(row.completed),
    passed:           Number(row.passed),
    averageScore:     Math.round(Number(row.avg_score)),
    bestScore:        Math.round(Number(row.best_score)),
    totalViolations:  Number(row.total_violations),
  }
}

async function getScoreHistory(internId: string) {
  // Last 10 finalized attempts ordered oldest→newest for the chart
  return sql`
    SELECT
      qa.percentage,
      qa.passed,
      qa."startedAt",
      q.title AS quiz_title,
      q."passingScore" AS passing_score
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa."internId" = ${internId}
    AND   qa.status    != 'IN_PROGRESS'
    AND   q."resultsPublishedAt" IS NOT NULL
    ORDER BY qa."startedAt" ASC
    LIMIT 10
  `
}

async function getLeaderboardStandings(internId: string) {
  // Quizzes where results are published and this intern has a finalized attempt
  return sql`
    SELECT
      q.id        AS quiz_id,
      q.title     AS quiz_title,
      qa.rank,
      qa.percentage,
      qa.passed,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS total_participants
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa."internId" = ${internId}
    AND   qa.status    != 'IN_PROGRESS'
    AND   q."resultsPublishedAt" IS NOT NULL
    AND   qa.rank IS NOT NULL
    ORDER BY qa."startedAt" DESC
  `
}

async function getPendingQuizzes(internId: string) {
  return sql`
    SELECT
      qa.id                                                         AS assignment_id,
      qa."startAt",
      qa."endAt",
      q.id                                                          AS quiz_id,
      q.title,
      q."timeLimitMinutes",
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id)       AS question_count,
      EXISTS (
        SELECT 1 FROM quiz_attempts
        WHERE "quizId" = q.id AND "internId" = ${internId} AND status = 'IN_PROGRESS'
      ) AS has_in_progress,
      CASE WHEN qa."startAt" IS NOT NULL THEN NOW() < qa."startAt" ELSE false END AS not_started_yet,
      CASE WHEN qa."endAt"   IS NOT NULL THEN NOW() > qa."endAt"   ELSE false END AS window_closed
    FROM quiz_assignments qa
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa."internId" = ${internId}
    AND q."isPublished" = true
    AND NOT EXISTS (
      SELECT 1 FROM quiz_attempts
      WHERE "quizId" = q.id AND "internId" = ${internId} AND status != 'IN_PROGRESS'
    )
    ORDER BY qa."endAt" ASC NULLS LAST, qa."assignedAt" DESC
    LIMIT 5
  `
}

// ─── Rank display ─────────────────────────────────────────────────────────────

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1) return (
    <span className="flex items-center gap-1 font-bold text-yellow-500">
      <Trophy className="size-4" /> 1st
    </span>
  )
  if (rank === 2) return (
    <span className="flex items-center gap-1 font-bold text-slate-400">
      <Medal className="size-4" /> 2nd
    </span>
  )
  if (rank === 3) return (
    <span className="flex items-center gap-1 font-bold text-amber-600">
      <Medal className="size-4" /> 3rd
    </span>
  )
  const pct = Math.round((rank / total) * 100)
  return (
    <span className="font-mono font-medium text-muted-foreground">
      #{rank} <span className="text-xs">({pct}th %ile)</span>
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InternDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [stats, scoreHistory, leaderboard, pendingQuizzes] = await Promise.all([
    getInternStats(session.user.id),
    getScoreHistory(session.user.id),
    getLeaderboardStandings(session.user.id),
    getPendingQuizzes(session.user.id),
  ])

  const completionRate = stats.assigned > 0
    ? Math.round((stats.completed / stats.assigned) * 100)
    : 0
  const passRate = stats.completed > 0
    ? Math.round((stats.passed / stats.completed) * 100)
    : 0

  // Serialize for client chart component
  const chartData = scoreHistory.map((r, i) => ({
    name: `Q${i + 1}`,
    quizTitle: r.quiz_title as string,
    score: Math.round(Number(r.percentage)),
    passing: Number(r.passing_score),
    passed: Boolean(r.passed),
    date: format(new Date(r.startedAt as string), "MMM d"),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, <strong>{session.user.name}</strong>. Here&apos;s your performance overview.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <FileQuestion className="size-4" /> Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completed}<span className="text-lg font-normal text-muted-foreground">/{stats.assigned}</span></div>
            <Progress value={completionRate} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{completionRate}% of assigned quizzes done</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="size-4" /> Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${passRate >= 70 ? "text-green-600" : passRate >= 50 ? "text-yellow-600" : "text-red-500"}`}>
              {passRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.passed} passed out of {stats.completed} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="size-4" /> Avg Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.averageScore}%</div>
            <Progress
              value={stats.averageScore}
              className={`mt-2 h-1.5 ${stats.averageScore >= 70 ? "[&>div]:bg-green-500" : stats.averageScore >= 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"}`}
            />
            <p className="text-xs text-muted-foreground mt-1">Best: {stats.bestScore}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="size-4" /> Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.totalViolations === 0 ? "text-green-600" : stats.totalViolations <= 3 ? "text-yellow-600" : "text-red-500"}`}>
              {stats.totalViolations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalViolations === 0 ? "Clean record 🎉" : "Total proctoring events"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Score trend chart ── */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" /> Score Trend
            </CardTitle>
            <CardDescription>
              Your scores across {chartData.length} published quiz{chartData.length !== 1 ? "zes" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InternScoreChart data={chartData} />
          </CardContent>
        </Card>
      )}

      {/* ── Leaderboard standings ── */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5" /> Your Leaderboard Standings
            </CardTitle>
            <CardDescription>Rankings across all published quizzes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Participants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row) => (
                  <TableRow key={row.quiz_id as string}>
                    <TableCell className="font-medium">{row.quiz_title as string}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-semibold ${row.passed ? "text-green-600" : "text-red-500"}`}>
                          {Math.round(Number(row.percentage))}%
                        </span>
                        <Progress
                          value={Number(row.percentage)}
                          className={`h-1 w-16 ${row.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.passed ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle className="mr-1 size-3" /> Passed
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RankBadge rank={row.rank as number} total={Number(row.total_participants)} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {Number(row.total_participants)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Pending quizzes ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-5" /> Pending Quizzes
              </CardTitle>
              <CardDescription>Quizzes that need your attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/intern/quizzes">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingQuizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="size-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">You have no pending quizzes at the moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingQuizzes.map((quiz) => {
                const windowClosed  = Boolean(quiz.window_closed)
                const notStartedYet = Boolean(quiz.not_started_yet)
                const hasInProgress = Boolean(quiz.has_in_progress)
                const endsAt        = quiz.endAt   ? new Date(quiz.endAt)   : null
                const startsAt      = quiz.startAt ? new Date(quiz.startAt) : null

                return (
                  <div
                    key={quiz.assignment_id as string}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{quiz.title as string}</p>
                        {windowClosed && <Badge variant="destructive" className="text-xs shrink-0">Closed</Badge>}
                        {hasInProgress && <Badge variant="secondary" className="text-xs shrink-0">In Progress</Badge>}
                        {notStartedYet && <Badge variant="outline" className="text-xs shrink-0">Not Open Yet</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileQuestion className="size-3.5" />
                          {quiz.question_count as number} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {quiz.timeLimitMinutes as number} min
                        </span>
                        {notStartedYet && startsAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            Opens <LocalTime date={startsAt} fmt="MMM d, h:mm a" />
                          </span>
                        )}
                        {!notStartedYet && endsAt && !windowClosed && (
                          <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="size-3.5" />
                            Join by <LocalTime date={endsAt} fmt="MMM d, h:mm a" />
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      asChild
                      disabled={windowClosed || notStartedYet}
                      size="sm"
                      className="shrink-0 ml-4"
                    >
                      <Link href={`/intern/quizzes/${quiz.quiz_id as string}`}>
                        <PlayCircle className="mr-2 size-4" />
                        {hasInProgress ? "Continue" : "Start"}
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
