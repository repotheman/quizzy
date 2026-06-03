export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileQuestion, Users, ClipboardCheck, TrendingUp, Trophy, BarChart3, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

async function getAdminStats() {
  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM quizzes)                                                         AS total_quizzes,
      (SELECT COUNT(*) FROM quizzes WHERE "isPublished" = true)                              AS published_quizzes,
      (SELECT COUNT(*) FROM users WHERE role = 'INTERN')                                     AS total_interns,
      (SELECT COUNT(*) FROM quiz_attempts WHERE status != 'IN_PROGRESS')                     AS completed_attempts,
      (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'IN_PROGRESS')                      AS active_attempts,
      (SELECT COALESCE(AVG(percentage), 0) FROM quiz_attempts WHERE status != 'IN_PROGRESS') AS avg_score,
      (SELECT COUNT(*) FROM quiz_attempts WHERE passed = true)                               AS total_passed,
      (SELECT COUNT(*) FROM quiz_attempts WHERE status != 'IN_PROGRESS')                     AS total_finished
  `
  return stats
}

async function getRecentActivity() {
  return sql`
    SELECT
      qa.id,
      qa.status,
      qa."submittedAt",
      qa."startedAt",
      qa.percentage,
      qa.passed,
      u.name  AS intern_name,
      q.title AS quiz_title
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    JOIN quizzes q ON qa."quizId" = q.id
    ORDER BY COALESCE(qa."submittedAt", qa."startedAt") DESC
    LIMIT 8
  `
}

async function getQuizzesNeedingAttention() {
  // Quizzes with completed attempts but results not yet published
  return sql`
    SELECT
      q.id,
      q.title,
      COUNT(qa.id) AS completed,
      (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id) AS assigned
    FROM quizzes q
    JOIN quiz_attempts qa ON qa."quizId" = q.id AND qa.status != 'IN_PROGRESS'
    WHERE q."resultsPublishedAt" IS NULL
    AND q."isPublished" = true
    GROUP BY q.id, q.title
    ORDER BY completed DESC
    LIMIT 5
  `
}

export default async function AdminDashboard() {
  const session = await auth()
  const [stats, recentActivity, needsAttention] = await Promise.all([
    getAdminStats(),
    getRecentActivity(),
    getQuizzesNeedingAttention(),
  ])

  const passRate = Number(stats.total_finished) > 0
    ? Math.round((Number(stats.total_passed) / Number(stats.total_finished)) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
            <FileQuestion className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(stats.total_quizzes)}</div>
            <p className="text-xs text-muted-foreground">
              {Number(stats.published_quizzes)} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interns</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(stats.total_interns)}</div>
            <p className="text-xs text-muted-foreground">
              {Number(stats.active_attempts)} currently in exam
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <TrendingUp className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passRate}%</div>
            <p className="text-xs text-muted-foreground">
              {Number(stats.completed_attempts)} total attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <ClipboardCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(Number(stats.avg_score))}%</div>
            <p className="text-xs text-muted-foreground">Across all attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-dashed hover:border-solid transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-5 text-yellow-500" /> Results & Rankings
            </CardTitle>
            <CardDescription>
              View per-quiz rankings, attendance, and publish results to interns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/results?tab=rankings">Open Results</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed hover:border-solid transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-5 text-blue-500" /> Analytics
            </CardTitle>
            <CardDescription>
              Platform-wide stats, intern performance, and violation breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/analytics">Open Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Recent activity ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest quiz attempts</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/results">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No attempts yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a) => (
                  <div key={a.id as string} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium truncate">{a.intern_name as string}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.quiz_title as string}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      {a.status === "IN_PROGRESS" ? (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="mr-1 size-3" /> In Progress
                        </Badge>
                      ) : a.status === "TERMINATED" ? (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="mr-1 size-3" /> Terminated
                        </Badge>
                      ) : a.status === "TIMED_OUT" ? (
                        <Badge variant="destructive" className="text-xs">Timed Out</Badge>
                      ) : a.passed ? (
                        <div>
                          <p className="text-sm font-medium text-green-600">{Math.round(Number(a.percentage))}%</p>
                          <p className="text-xs text-muted-foreground">Passed</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-red-500">{Math.round(Number(a.percentage))}%</p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Needs attention ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending Result Publish</CardTitle>
                <CardDescription>Quizzes with completed attempts but results not yet published</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/results?tab=rankings">Leaderboard</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 py-8 justify-center">
                <CheckCircle className="size-5" />
                <span className="text-sm">All results published</span>
              </div>
            ) : (
              <div className="space-y-3">
                {needsAttention.map((q) => (
                  <div key={q.id as string} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{q.title as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(q.completed)} / {Number(q.assigned)} completed
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/results?quizId=${q.id}&tab=rankings`}>Publish</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
