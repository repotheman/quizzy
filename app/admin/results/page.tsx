import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClipboardList,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  Award,
} from "lucide-react"
import { format } from "date-fns"

async function getQuizzes() {
  return sql`
    SELECT id, title FROM quizzes WHERE "isPublished" = true ORDER BY "createdAt" DESC
  `
}

import { LocalTime } from "@/components/ui/local-time"

async function getResults(quizId?: string) {
  // quizId is undefined when "all" is selected — filter only when a real ID is passed
  const results = await sql`
    SELECT
      qa.id,
      qa.status,
      qa.score,
      qa."totalPoints",
      qa.percentage,
      qa.passed,
      qa.rank,
      qa.violations,
      qa."timeSpentSeconds",
      qa."startedAt",
      qa."submittedAt",
      qa."scoreOverriddenAt",
      u.name  AS intern_name,
      u.email AS intern_email,
      q.id    AS quiz_id,
      q.title AS quiz_title,
      q."passingScore" AS passing_score,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id) AS violation_count
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE (${quizId ?? null}::text IS NULL OR qa."quizId" = ${quizId ?? null})
    ORDER BY qa."startedAt" DESC
  `
  return results
}

async function getQuizStats(quizId: string) {
  const [stats] = await sql`
    SELECT
      COUNT(*)                                                          AS total,
      COUNT(*) FILTER (WHERE status != 'IN_PROGRESS')                  AS completed,
      COUNT(*) FILTER (WHERE passed = true)                            AS passed,
      COALESCE(AVG(percentage) FILTER (WHERE status != 'IN_PROGRESS'), 0) AS avg_pct,
      COALESCE(MAX(percentage) FILTER (WHERE status != 'IN_PROGRESS'), 0) AS max_pct,
      COALESCE(MIN(percentage) FILTER (WHERE status != 'IN_PROGRESS'), 0) AS min_pct
    FROM quiz_attempts
    WHERE "quizId" = ${quizId}
  `
  return stats
}

function StatusBadge({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === "IN_PROGRESS")
    return <Badge variant="secondary"><Clock className="mr-1 size-3" />In Progress</Badge>
  if (status === "TIMED_OUT")
    return <Badge variant="destructive"><Clock className="mr-1 size-3" />Timed Out</Badge>
  if (status === "TERMINATED")
    return <Badge variant="destructive"><AlertTriangle className="mr-1 size-3" />Terminated</Badge>
  if (passed)
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"><CheckCircle className="mr-1 size-3" />Passed</Badge>
  return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"><XCircle className="mr-1 size-3" />Failed</Badge>
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ quizId?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")

  const { quizId: rawQuizId } = await searchParams
  // "all" from the select means no filter
  const effectiveQuizId = rawQuizId === "all" ? undefined : rawQuizId
  const [quizzes, results] = await Promise.all([getQuizzes(), getResults(effectiveQuizId)])
  const stats = effectiveQuizId ? await getQuizStats(effectiveQuizId) : null
  const selectedQuiz = quizzes.find((q) => q.id === effectiveQuizId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            Quiz attempt results and per-student analysis
          </p>
        </div>

        {/* Quiz filter */}
        <form method="GET" className="flex items-center gap-2">
          <Select name="quizId" defaultValue={rawQuizId ?? "all"}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All quizzes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All quizzes</SelectItem>
              {quizzes.map((q) => (
                <SelectItem key={q.id as string} value={q.id as string}>
                  {q.title as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" size="sm">Filter</Button>
        </form>
      </div>

      {/* Stats row — only when a quiz is selected */}
      {stats && selectedQuiz && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="size-4" /> Total Attempts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Number(stats.total)}</div>
              <p className="text-xs text-muted-foreground">{Number(stats.completed)} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Award className="size-4" /> Pass Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Number(stats.completed) > 0
                  ? `${Math.round((Number(stats.passed) / Number(stats.completed)) * 100)}%`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground">{Number(stats.passed)} passed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="size-4" /> Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(Number(stats.avg_pct))}%</div>
              <Progress value={Number(stats.avg_pct)} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Target className="size-4" /> Score Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(Number(stats.min_pct))}–{Math.round(Number(stats.max_pct))}%
              </div>
              <p className="text-xs text-muted-foreground">min – max</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results table */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results yet</h3>
            <p className="text-muted-foreground text-center">
              {effectiveQuizId
                ? "No attempts recorded for this quiz yet."
                : "Results will appear here once interns complete their assigned quizzes."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedQuiz ? `${selectedQuiz.title as string} — Attempts` : "All Attempts"}
            </CardTitle>
            <CardDescription>
              {results.length} attempt{results.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {!effectiveQuizId && <TableHead>Quiz</TableHead>}
                  <TableHead>Intern</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead className="text-right">Violations</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id as string}>
                    {!effectiveQuizId && (
                      <TableCell className="font-medium max-w-[180px] truncate">
                        {r.quiz_title as string}
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <p className="font-medium leading-tight">{r.intern_name as string}</p>
                        <p className="text-xs text-muted-foreground">{r.intern_email as string}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status as string} passed={r.passed as boolean | null} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.score != null
                        ? `${r.score}/${r.totalPoints}`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.percentage != null ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-semibold text-sm ${r.passed ? "text-green-600" : "text-red-500"}`}>
                            {Math.round(Number(r.percentage))}%
                          </span>
                          <Progress
                            value={Number(r.percentage)}
                            className={`h-1.5 w-20 ${r.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.rank != null
                        ? <span className="font-mono font-medium">#{r.rank as number}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.timeSpentSeconds
                        ? `${Math.floor(Number(r.timeSpentSeconds) / 60)}m ${Number(r.timeSpentSeconds) % 60}s`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(r.violation_count) > 0 ? (
                        <Badge variant="destructive" className="font-mono">
                          <AlertTriangle className="mr-1 size-3" />
                          {r.violation_count as number}
                        </Badge>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400">Clean</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      <LocalTime date={r.startedAt as string} fmt="MMM d, yyyy" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/results/${r.id as string}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
