import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  TrendingUp, Users, Trophy, Target, AlertTriangle,
  Clock, CheckCircle, XCircle, BarChart3, Flame, Snowflake,
} from "lucide-react"
import nextDynamic from "next/dynamic"

const InternPerformanceChart = nextDynamic(
  () => import("./charts").then((mod) => mod.InternPerformanceChart)
)
const TrendlineChart = nextDynamic(
  () => import("./charts").then((mod) => mod.TrendlineChart)
)
const InternProgressChart = nextDynamic(
  () => import("./charts").then((mod) => mod.InternProgressChart)
)

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getAnalyticsData() {
  // Run all independent queries concurrently instead of sequentially
  const [
    [platform],
    internPerformance,
    trendline,
    internProgress,
    difficulty,
    violationBreakdown,
    quizStats,
  ] = await Promise.all([
    // Platform-wide stats
    sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'INTERN')                                      AS total_interns,
        (SELECT COUNT(*) FROM quizzes WHERE "isPublished" = true)                               AS published_quizzes,
        (SELECT COUNT(*) FROM quiz_attempts WHERE status != 'IN_PROGRESS')                      AS total_attempts,
        (SELECT COUNT(*) FROM quiz_attempts WHERE passed = true)                                AS total_passed,
        (SELECT COALESCE(AVG(percentage), 0) FROM quiz_attempts WHERE status != 'IN_PROGRESS')  AS avg_score,
        (SELECT COALESCE(AVG("timeSpentSeconds"), 0) FROM quiz_attempts WHERE status != 'IN_PROGRESS' AND "timeSpentSeconds" IS NOT NULL) AS avg_time,
        (SELECT COUNT(*) FROM violations)                                                       AS total_violations,
        (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'TERMINATED')                        AS terminated_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'TIMED_OUT')                         AS timed_out_count
    `,
    // Intern performance — latest score per intern (for bar chart)
    sql`
      SELECT
        u.name,
        u.id,
        COALESCE(AVG(qa.percentage) FILTER (WHERE qa.status != 'IN_PROGRESS'), 0) AS avg_score,
        MAX(qa.percentage) FILTER (WHERE qa.status != 'IN_PROGRESS')              AS best_score,
        COUNT(qa.id) FILTER (WHERE qa.status != 'IN_PROGRESS')                    AS attempts,
        COUNT(qa.id) FILTER (WHERE qa.passed = true)                              AS passed,
        SUM(qa.violations)                                                         AS total_violations,
        COUNT(qa.id) FILTER (WHERE qa.status = 'TERMINATED')                      AS terminated
      FROM users u
      LEFT JOIN quiz_attempts qa ON qa."internId" = u.id
      WHERE u.role = 'INTERN'
      GROUP BY u.id, u.name
      ORDER BY avg_score DESC NULLS LAST
    `,
    // Trendline — avg/min/max score per quiz over time
    sql`
      SELECT
        q.title                                                                     AS quiz,
        q."createdAt"                                                               AS created_at,
        ROUND(AVG(qa.percentage)::numeric, 1)                                       AS avg,
        ROUND(MIN(qa.percentage)::numeric, 1)                                       AS min,
        ROUND(MAX(qa.percentage)::numeric, 1)                                       AS max,
        COUNT(qa.id)                                                                AS attempts
      FROM quizzes q
      JOIN quiz_attempts qa ON qa."quizId" = q.id AND qa.status != 'IN_PROGRESS'
      WHERE q."isPublished" = true
      GROUP BY q.id, q.title, q."createdAt"
      ORDER BY q."createdAt" ASC
    `,
    // Intern progress — each intern's score per quiz (for multi-line chart)
    sql`
      SELECT
        u.id   AS intern_id,
        u.name AS intern_name,
        q.title AS quiz,
        q."createdAt",
        qa.percentage,
        qa.passed
      FROM quiz_attempts qa
      JOIN users u ON u.id = qa."internId"
      JOIN quizzes q ON q.id = qa."quizId"
      WHERE qa.status != 'IN_PROGRESS'
      AND   q."isPublished" = true
      ORDER BY q."createdAt" ASC, u.name ASC
    `,
    // Test difficulty
    sql`
      SELECT
        q.id,
        q.title,
        ROUND(AVG(qa.percentage)::numeric, 1)  AS avg_score,
        ROUND(MIN(qa.percentage)::numeric, 1)  AS min_score,
        ROUND(MAX(qa.percentage)::numeric, 1)  AS max_score,
        COUNT(qa.id)                           AS attempts
      FROM quizzes q
      JOIN quiz_attempts qa ON qa."quizId" = q.id AND qa.status != 'IN_PROGRESS'
      WHERE q."isPublished" = true
      GROUP BY q.id, q.title
      HAVING COUNT(qa.id) >= 1
      ORDER BY avg_score ASC
    `,
    // Violation breakdown
    sql`
      SELECT type, COUNT(*) AS count
      FROM violations
      GROUP BY type
      ORDER BY count DESC
    `,
    // Per-quiz stats for table
    sql`
      SELECT
        q.id, q.title, q."passingScore", q."timeLimitMinutes", q."resultsPublishedAt",
        COUNT(qa.id)                                                                           AS attempts,
        COUNT(qa.id) FILTER (WHERE qa.passed = true)                                          AS passed,
        COUNT(qa.id) FILTER (WHERE qa.status = 'TERMINATED')                                  AS terminated,
        COUNT(qa.id) FILTER (WHERE qa.status = 'TIMED_OUT')                                   AS timed_out,
        COALESCE(AVG(qa.percentage) FILTER (WHERE qa.status != 'IN_PROGRESS'), 0)             AS avg_score,
        COALESCE(MIN(qa.percentage) FILTER (WHERE qa.status != 'IN_PROGRESS'), 0)             AS min_score,
        COALESCE(MAX(qa.percentage) FILTER (WHERE qa.status != 'IN_PROGRESS'), 0)             AS max_score,
        COALESCE(AVG(qa."timeSpentSeconds") FILTER (WHERE qa."timeSpentSeconds" IS NOT NULL), 0) AS avg_time,
        (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id)                         AS assigned,
        (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id AND "joinedAt" IS NOT NULL) AS joined
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON qa."quizId" = q.id AND qa.status != 'IN_PROGRESS'
      WHERE q."isPublished" = true
      GROUP BY q.id, q.title, q."passingScore", q."timeLimitMinutes", q."resultsPublishedAt"
      ORDER BY attempts DESC, q."createdAt" DESC
    `,
  ])

  return { platform, internPerformance, trendline, internProgress, difficulty, violationBreakdown, quizStats }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const violationLabels: Record<string, string> = {
  TAB_SWITCH: "Tab Switch", FULLSCREEN_EXIT: "Fullscreen Exit",
  COPY_ATTEMPT: "Copy Attempt", PASTE_ATTEMPT: "Paste Attempt",
  RIGHT_CLICK: "Right Click", DEVTOOLS_OPEN: "DevTools Open",
  WINDOW_BLUR: "Window Blur", CONTEXT_MENU: "Context Menu",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")

  const { platform, internPerformance, trendline, internProgress, difficulty, violationBreakdown, quizStats } =
    await getAnalyticsData()

  const passRate = Number(platform.total_attempts) > 0
    ? Math.round((Number(platform.total_passed) / Number(platform.total_attempts)) * 100)
    : 0
  const avgMinutes = Math.round(Number(platform.avg_time) / 60)
  const maxViolations = violationBreakdown.reduce((m, v) => Math.max(m, Number(v.count)), 1)

  // Serialise for client charts
  const barData = internPerformance.map(i => ({
    name: (i.name as string).split(" ")[0], // first name only for chart
    fullName: i.name as string,
    score: Math.round(Number(i.avg_score)),
    best: Math.round(Number(i.best_score) || 0),
  }))

  const trendData = trendline.map(t => ({
    quiz: t.quiz as string,
    avg: Number(t.avg),
    min: Number(t.min),
    max: Number(t.max),
  }))

  // Build intern progress: array of { quiz, [internName]: score, ... }
  const quizOrder = [...new Set(internProgress.map(r => r.quiz as string))]
  const internNames = [...new Set(internProgress.map(r => r.intern_name as string))]
  const progressData = quizOrder.map(quiz => {
    const row: Record<string, string | number> = { quiz: quiz as string }
    internProgress
      .filter(r => r.quiz === quiz)
      .forEach(r => { row[r.intern_name as string] = Math.round(Number(r.percentage)) })
    return row
  })

  const hardest = difficulty[0] ?? null
  const easiest = difficulty[difficulty.length - 1] ?? null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide performance and insights</p>
      </div>

      {/* ── Platform stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Interns</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(platform.total_interns)}</div>
            <p className="text-xs text-muted-foreground">{Number(platform.published_quizzes)} published quizzes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <TrendingUp className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passRate}%</div>
            <p className="text-xs text-muted-foreground">{Number(platform.total_passed)} / {Number(platform.total_attempts)} attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(Number(platform.avg_score))}%</div>
            <p className="text-xs text-muted-foreground">Across all completed attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMinutes}m</div>
            <p className="text-xs text-muted-foreground">
              {Number(platform.terminated_count)} terminated · {Number(platform.timed_out_count)} timed out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row 1: Intern Performance + Trendline ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intern Performance</CardTitle>
            <CardDescription>Average score across all tests per intern</CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No data yet.</p>
            ) : (
              <InternPerformanceChart data={barData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trendline</CardTitle>
            <CardDescription>Average percentage with min/max range per test</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No data yet.</p>
            ) : (
              <TrendlineChart data={trendData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row 2: Intern Progress + Test Difficulty + Leaderboard ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Intern Progress — takes 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Intern Progress</CardTitle>
            <CardDescription>Score progression across assessments per intern</CardDescription>
          </CardHeader>
          <CardContent>
            {progressData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No data yet.</p>
            ) : (
              <InternProgressChart data={progressData} interns={internNames} />
            )}
          </CardContent>
        </Card>

        {/* Test Difficulty + Leaderboard sidebar */}
        <div className="space-y-4">
          {/* Test Difficulty */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Test Difficulty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hardest && easiest && hardest.id !== easiest.id ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-1.5 mt-0.5">
                      <Flame className="size-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hardest</p>
                      <p className="font-medium text-sm truncate">{hardest.title as string}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg {Math.round(Number(hardest.avg_score))}% · min {Math.round(Number(hardest.min_score))}%, max {Math.round(Number(hardest.max_score))}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-1.5 mt-0.5">
                      <Snowflake className="size-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Easiest</p>
                      <p className="font-medium text-sm truncate">{easiest.title as string}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg {Math.round(Number(easiest.avg_score))}% · min {Math.round(Number(easiest.min_score))}%, max {Math.round(Number(easiest.max_score))}%
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Need at least 2 quizzes with attempts.</p>
              )}
            </CardContent>
          </Card>

          {/* Overall Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-yellow-500" /> Overall Leaderboard
              </CardTitle>
              <CardDescription>By average score across all tests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {internPerformance.slice(0, 9).map((intern, idx) => {
                  const avg = Math.round(Number(intern.avg_score))
                  const total = Number(intern.attempts) > 0
                    ? `${avg}/${Math.round(Number(intern.best_score) || 0)}`
                    : "—"
                  return (
                    <div key={intern.id as string} className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${idx === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : idx === 1 ? "bg-slate-500/5" : idx === 2 ? "bg-amber-500/5" : ""}`}>
                      <span className={`text-sm font-mono w-5 text-center ${idx === 0 ? "text-yellow-500 font-bold" : idx === 1 ? "text-slate-400 font-bold" : idx === 2 ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{intern.name as string}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {Number(intern.attempts) > 0 ? `${avg}%` : "—"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Violation breakdown ── */}
      {violationBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" /> Violation Breakdown
            </CardTitle>
            <CardDescription>
              {Number(platform.total_violations)} total violations across all attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {violationBreakdown.map((v) => {
                const count = Number(v.count)
                const pct = Math.round((count / maxViolations) * 100)
                return (
                  <div key={v.type as string} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{violationLabels[v.type as string] ?? v.type as string}</span>
                      <span className="font-mono font-medium">{count}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Per-quiz table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" /> Quiz Breakdown
          </CardTitle>
          <CardDescription>Detailed stats per quiz</CardDescription>
        </CardHeader>
        <CardContent>
          {quizStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No published quizzes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Pass Rate</TableHead>
                  <TableHead>Avg Score</TableHead>
                  <TableHead>Score Range</TableHead>
                  <TableHead>Avg Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizStats.map((q) => {
                  const attempts   = Number(q.attempts)
                  const passed     = Number(q.passed)
                  const assigned   = Number(q.assigned)
                  const joined     = Number(q.joined)
                  const passRate   = attempts > 0 ? Math.round((passed / attempts) * 100) : 0
                  const attendance = assigned > 0 ? Math.round((joined / assigned) * 100) : 0
                  const avgScore   = Math.round(Number(q.avg_score))
                  const avgTime    = Math.round(Number(q.avg_time) / 60)

                  return (
                    <TableRow key={q.id as string}>
                      <TableCell>
                        <p className="font-medium">{q.title as string}</p>
                        <p className="text-xs text-muted-foreground">{q.timeLimitMinutes as number} min · pass {q.passingScore as number}%</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{joined}/{assigned}</span>
                        <span className="text-xs text-muted-foreground ml-1">({attendance}%)</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${passRate >= 70 ? "text-green-600" : passRate >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                          {passed}/{attempts} ({passRate}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        {attempts > 0 ? (
                          <div className="space-y-1 w-24">
                            <span className="text-sm font-medium">{avgScore}%</span>
                            <Progress value={avgScore} className="h-1.5" />
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {attempts > 0 ? `${Math.round(Number(q.min_score))}% – ${Math.round(Number(q.max_score))}%` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{attempts > 0 ? `${avgTime}m` : "—"}</TableCell>
                      <TableCell>
                        {q.resultsPublishedAt
                          ? <Badge variant="outline" className="text-green-600 text-xs">Published</Badge>
                          : <Badge variant="outline" className="text-muted-foreground text-xs">Pending</Badge>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
