import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trophy, Medal, Clock, Target, AlertTriangle, CheckCircle, XCircle, Users, Lock } from "lucide-react"
import { format } from "date-fns"
import { PublishResultsButton } from "./publish-results-button"

async function getPublishedQuizzes() {
  return sql`
    SELECT id, title, "resultsPublishedAt"
    FROM quizzes
    WHERE "isPublished" = true
    ORDER BY "createdAt" DESC
  `
}

async function getLeaderboard(quizId: string) {
  const [quiz] = await sql`
    SELECT
      q.id,
      q.title,
      q."timeLimitMinutes",
      q."passingScore",
      q."resultsPublishedAt",
      q."resultsPublishedBy",
      (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id)                          AS total_assigned,
      (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id AND "joinedAt" IS NOT NULL) AS total_joined,
      (SELECT COUNT(*) FROM quiz_attempts    WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS total_completed,
      (SELECT COUNT(*) FROM quiz_attempts    WHERE "quizId" = q.id AND passed = true)           AS total_passed,
      (SELECT COALESCE(AVG(percentage), 0)   FROM quiz_attempts WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS avg_score
    FROM quizzes q
    WHERE q.id = ${quizId}
  `

  if (!quiz) return null

  const attempts = await sql`
    SELECT
      qa.id            AS attempt_id,
      qa.rank,
      qa.status,
      qa.score,
      qa."totalPoints",
      qa.percentage,
      qa.passed,
      qa.violations,
      qa."timeSpentSeconds",
      qa."startedAt",
      qa."submittedAt",
      qa."autoSubmitted",
      u.id             AS intern_id,
      u.name           AS intern_name,
      u.email          AS intern_email,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id) AS violation_count
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa."internId"
    WHERE qa."quizId" = ${quizId}
    AND   qa.status  != 'IN_PROGRESS'
    ORDER BY
      qa.percentage    DESC NULLS LAST,
      qa."timeSpentSeconds" ASC NULLS LAST
  `

  // Interns assigned but never joined
  const notJoined = await sql`
    SELECT u.id, u.name, u.email
    FROM quiz_assignments qa
    JOIN users u ON u.id = qa."internId"
    WHERE qa."quizId" = ${quizId}
    AND   qa."joinedAt" IS NULL
  `

  return { quiz, attempts, notJoined }
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) return <span className="text-muted-foreground">—</span>
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
  return <span className="font-mono font-medium text-muted-foreground">#{rank}</span>
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ quizId?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")

  const { quizId } = await searchParams
  const quizzes = await getPublishedQuizzes()

  const selectedQuizId = quizId || (quizzes[0]?.id as string | undefined)
  const data = selectedQuizId ? await getLeaderboard(selectedQuizId) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">Per-quiz rankings and attendance</p>
        </div>
      </div>

      {/* Quiz selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Quiz:</span>
        <form method="GET">
          <Select name="quizId" defaultValue={selectedQuizId} >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a quiz" />
            </SelectTrigger>
            <SelectContent>
              {quizzes.map((q) => (
                <SelectItem key={q.id as string} value={q.id as string}>
                  {q.title as string}
                  {q.resultsPublishedAt ? " ✓" : " (unpublished)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="submit" className="sr-only">Go</button>
        </form>
        {quizzes.map((q) => q.id === selectedQuizId && (
          <Button key={q.id as string} variant="outline" size="sm" asChild>
            <Link href={`?quizId=${q.id}`} replace>View</Link>
          </Button>
        ))}
      </div>

      {!data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Trophy className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
            <p className="text-muted-foreground">Publish a quiz to see its leaderboard.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quiz stats row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(data.quiz.total_assigned)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Joined</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(data.quiz.total_joined)}</div>
                <p className="text-xs text-muted-foreground">
                  {Number(data.quiz.total_assigned) > 0
                    ? `${Math.round((Number(data.quiz.total_joined) / Number(data.quiz.total_assigned)) * 100)}% attendance`
                    : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(data.quiz.total_completed)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {Number(data.quiz.total_completed) > 0
                    ? `${Math.round((Number(data.quiz.total_passed) / Number(data.quiz.total_completed)) * 100)}%`
                    : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(Number(data.quiz.avg_score))}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Publish / results status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {data.quiz.resultsPublishedAt ? (
                      <><CheckCircle className="size-5 text-green-500" /> Results Published</>
                    ) : (
                      <><Lock className="size-5 text-muted-foreground" /> Results Hidden</>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {data.quiz.resultsPublishedAt
                      ? `Published ${format(new Date(data.quiz.resultsPublishedAt as string), "PPpp")}`
                      : "Interns cannot see scores or ranks until you publish results."}
                  </CardDescription>
                </div>
                {!data.quiz.resultsPublishedAt && (
                  <PublishResultsButton quizId={selectedQuizId!} />
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Rankings table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5" /> Rankings
              </CardTitle>
              <CardDescription>
                Sorted by score (desc), time spent (asc) as tiebreaker
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No completed attempts yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Intern</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time Spent</TableHead>
                      <TableHead>Violations</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attempts.map((a, idx) => (
                      <TableRow
                        key={a.attempt_id as string}
                        className={idx === 0 ? "bg-yellow-500/5" : idx === 1 ? "bg-slate-500/5" : idx === 2 ? "bg-amber-500/5" : ""}
                      >
                        <TableCell>
                          <RankBadge rank={data.quiz.resultsPublishedAt ? (a.rank as number | null) : null} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{a.intern_name as string}</p>
                            <p className="text-xs text-muted-foreground">{a.intern_email as string}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {a.percentage !== null ? (
                            <div className="flex items-center gap-1">
                              <Target className="size-3.5 text-muted-foreground" />
                              <span className={a.passed ? "text-green-600 font-medium" : "text-red-500"}>
                                {Math.round(Number(a.percentage))}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({a.score}/{a.totalPoints})
                              </span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {a.status === "TERMINATED" ? (
                            <Badge variant="destructive">Terminated</Badge>
                          ) : a.status === "TIMED_OUT" ? (
                            <Badge variant="destructive">Timed Out</Badge>
                          ) : a.passed ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              <CheckCircle className="mr-1 size-3" /> Passed
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              <XCircle className="mr-1 size-3" /> Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.timeSpentSeconds ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Clock className="size-3.5 text-muted-foreground" />
                              {Math.floor(Number(a.timeSpentSeconds) / 60)}m {Number(a.timeSpentSeconds) % 60}s
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {Number(a.violation_count) > 0 ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 size-3" />
                              {a.violation_count as number}
                            </Badge>
                          ) : (
                            <span className="text-green-600 text-sm">Clean</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.submittedAt
                            ? format(new Date(a.submittedAt as string), "MMM d, h:mm a")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/results/${a.attempt_id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Not joined */}
          {data.notJoined.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-5" /> Did Not Join ({data.notJoined.length})
                </CardTitle>
                <CardDescription>
                  These interns were assigned but never started the quiz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.notJoined.map((i) => (
                    <Badge key={i.id as string} variant="outline">
                      {i.name as string}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
