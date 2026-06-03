import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
export const dynamic = 'force-dynamic'

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  ClipboardList, Clock, Target, AlertTriangle, CheckCircle, XCircle,
  Users, TrendingUp, Award, Trophy, Medal, Lock, BarChart2,
} from "lucide-react"
import { LocalTime } from "@/components/ui/local-time"
import { PublishResultsButton } from "../leaderboard/publish-results-button"
import { UnpublishResultsButton } from "../leaderboard/unpublish-results-button"
import { ExportCsvButton } from "../leaderboard/export-csv-button"
import { BulkAiFeedbackPanel } from "./bulk-ai-feedback-panel"

async function getAllQuizzes() {
  return sql`
    SELECT id, title, "isPublished", "resultsPublishedAt"
    FROM quizzes
    ORDER BY "createdAt" DESC
  `
}

async function getQuizDetails(quizId: string) {
  const [quiz] = await sql`
    SELECT
      q.id, q.title, q."passingScore", q."timeLimitMinutes",
      q."resultsPublishedAt", q."resultsPublishedBy",
      (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id) AS total_assigned,
      (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id AND "joinedAt" IS NOT NULL) AS total_joined,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS total_completed,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "quizId" = q.id AND status = 'IN_PROGRESS') AS total_in_progress,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "quizId" = q.id AND passed = true) AS total_passed,
      (SELECT COALESCE(AVG(percentage), 0) FROM quiz_attempts WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS avg_score,
      (SELECT COALESCE(MAX(percentage), 0) FROM quiz_attempts WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS max_score,
      (SELECT COALESCE(MIN(percentage), 0) FROM quiz_attempts WHERE "quizId" = q.id AND status != 'IN_PROGRESS') AS min_score
    FROM quizzes q WHERE q.id = ${quizId}
  `
  return quiz ?? null
}

async function getAttempts(quizId: string) {
  return sql`
    SELECT
      qa.id, qa.status, qa.score, qa."totalPoints", qa.percentage, qa.passed,
      qa.rank, qa.violations, qa."timeSpentSeconds", qa."startedAt", qa."submittedAt",
      qa."scoreOverriddenAt",
      u.name AS intern_name, u.email AS intern_email,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id) AS violation_count
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    WHERE qa."quizId" = ${quizId}
    ORDER BY
      CASE qa.status WHEN 'IN_PROGRESS' THEN 0 ELSE 1 END,
      qa.percentage DESC NULLS LAST,
      qa."timeSpentSeconds" ASC NULLS LAST
  `
}

async function getNotJoined(quizId: string) {
  return sql`
    SELECT u.id, u.name, u.email
    FROM quiz_assignments qa
    JOIN users u ON u.id = qa."internId"
    WHERE qa."quizId" = ${quizId} AND qa."joinedAt" IS NULL
    ORDER BY u.name ASC
  `
}

function StatusBadge({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === "IN_PROGRESS") return <Badge variant="secondary" className="gap-1"><Clock className="size-3" />In Progress</Badge>
  if (status === "TIMED_OUT")   return <Badge variant="destructive" className="gap-1"><Clock className="size-3" />Timed Out</Badge>
  if (status === "TERMINATED")  return <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" />Terminated</Badge>
  if (passed) return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1"><CheckCircle className="size-3" />Passed</Badge>
  return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 gap-1"><XCircle className="size-3" />Failed</Badge>
}

function RankCell({ rank, isPublished }: { rank: number | null; isPublished: boolean }) {
  if (!isPublished || rank == null) return <span className="text-muted-foreground">—</span>
  if (rank === 1) return <span className="flex items-center gap-1 font-bold text-yellow-500"><Trophy className="size-3.5" />1st</span>
  if (rank === 2) return <span className="flex items-center gap-1 font-bold text-slate-400"><Medal className="size-3.5" />2nd</span>
  if (rank === 3) return <span className="flex items-center gap-1 font-bold text-amber-600"><Medal className="size-3.5" />3rd</span>
  return <span className="font-mono font-medium text-muted-foreground">#{rank}</span>
}

function fmt(s: number) { return `${Math.floor(s / 60)}m ${s % 60}s` }

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ quizId?: string; tab?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")

  const { quizId: rawQuizId, tab = "overview" } = await searchParams
  const quizzes = await getAllQuizzes()
  const effectiveQuizId = rawQuizId ?? (quizzes[0]?.id as string | undefined)

  const [quiz, attempts, notJoined] = effectiveQuizId
    ? await Promise.all([getQuizDetails(effectiveQuizId), getAttempts(effectiveQuizId), getNotJoined(effectiveQuizId)])
    : [null, [], []]

  const finalized   = attempts.filter((a) => a.status !== "IN_PROGRESS")
  const inProgress  = attempts.filter((a) => a.status === "IN_PROGRESS")
  const isPublished = !!quiz?.resultsPublishedAt

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">Per-quiz scores, rankings, and analysis</p>
        </div>
        <form method="GET" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <Select name="quizId" defaultValue={effectiveQuizId ?? ""}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a quiz" />
            </SelectTrigger>
            <SelectContent>
              {quizzes.map((q) => (
                <SelectItem key={q.id as string} value={q.id as string}>
                  {q.title as string}{q.resultsPublishedAt ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" size="sm">Load</Button>
        </form>
      </div>

      {!quiz ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
            <p className="text-muted-foreground text-center">Create and publish a quiz to start seeing results here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Publish / export controls */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`size-9 rounded-full flex items-center justify-center ${isPublished ? "bg-green-500/10" : "bg-muted"}`}>
                    {isPublished ? <CheckCircle className="size-5 text-green-500" /> : <Lock className="size-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <CardTitle className="text-base">{isPublished ? "Results Published" : "Results Hidden"}</CardTitle>
                    <CardDescription>
                      {isPublished
                        ? <><span>Published </span><LocalTime date={quiz.resultsPublishedAt as string} fmt="MMM d, yyyy 'at' h:mm a" /><span> · Interns can see scores and ranks</span></>
                        : "Interns cannot see their scores or rankings yet"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {finalized.length > 0 && <ExportCsvButton quizId={effectiveQuizId!} />}
                  {isPublished
                    ? <UnpublishResultsButton quizId={effectiveQuizId!} />
                    : finalized.length > 0 && <PublishResultsButton quizId={effectiveQuizId!} />}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Users className="size-4" />Assigned</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(quiz.total_assigned)}</div>
                <p className="text-xs text-muted-foreground">{Number(quiz.total_joined)} joined ({Number(quiz.total_assigned) > 0 ? Math.round((Number(quiz.total_joined) / Number(quiz.total_assigned)) * 100) : 0}%)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><ClipboardList className="size-4" />Completed</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(quiz.total_completed)}</div>
                {Number(quiz.total_in_progress) > 0 && <p className="text-xs text-yellow-600 dark:text-yellow-400">{Number(quiz.total_in_progress)} in progress</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Award className="size-4" />Pass Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{Number(quiz.total_completed) > 0 ? `${Math.round((Number(quiz.total_passed) / Number(quiz.total_completed)) * 100)}%` : "—"}</div>
                <p className="text-xs text-muted-foreground">{Number(quiz.total_passed)} passed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><TrendingUp className="size-4" />Avg Score</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(Number(quiz.avg_score))}%</div>
                <Progress value={Number(quiz.avg_score)} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><BarChart2 className="size-4" />Score Range</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(Number(quiz.min_score))}–{Math.round(Number(quiz.max_score))}%</div>
                <p className="text-xs text-muted-foreground">min – max</p>
              </CardContent>
            </Card>
          </div>

          {/* Tab nav — plain links, no Radix Tabs to avoid hydration mismatch */}
          <div className="flex gap-0 border-b">
            {([
              { value: "overview", label: "All Attempts" },
              { value: "rankings", label: `Rankings${isPublished ? " ✓" : ""}` },
              ...(notJoined.length > 0 ? [{ value: "absent", label: `Did Not Join (${notJoined.length})` }] : []),
            ] as { value: string; label: string }[]).map(({ value, label }) => (
              <Link
                key={value}
                href={`?quizId=${effectiveQuizId}&tab=${value}`}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  tab === value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── All Attempts ── */}
          {tab === "overview" && (
            <div className="mt-4">
              {attempts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <ClipboardList className="size-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No attempts yet</h3>
                    <p className="text-muted-foreground">Results will appear here once interns start taking this quiz.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>{quiz.title as string} — All Attempts</CardTitle>
                    <CardDescription>{attempts.length} attempt{attempts.length !== 1 ? "s" : ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Intern</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Rank</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                          <TableHead className="text-right">Violations</TableHead>
                          <TableHead className="text-right">Date</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attempts.map((r) => (
                          <TableRow key={r.id as string} className={r.status === "IN_PROGRESS" ? "opacity-60" : ""}>
                            <TableCell>
                              <p className="font-medium leading-tight">{r.intern_name as string}</p>
                              <p className="text-xs text-muted-foreground">{r.intern_email as string}</p>
                            </TableCell>
                            <TableCell><StatusBadge status={r.status as string} passed={r.passed as boolean | null} /></TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {r.score != null ? `${r.score}/${r.totalPoints}` : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.percentage != null ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`font-semibold text-sm ${r.passed ? "text-green-600" : r.status === "IN_PROGRESS" ? "text-muted-foreground" : "text-red-500"}`}>{Math.round(Number(r.percentage))}%</span>
                                  <Progress value={Number(r.percentage)} className={`h-1.5 w-20 ${r.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`} />
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right"><RankCell rank={r.rank as number | null} isPublished={isPublished} /></TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{r.timeSpentSeconds ? fmt(Number(r.timeSpentSeconds)) : "—"}</TableCell>
                            <TableCell className="text-right">
                              {Number(r.violation_count) > 0
                                ? <Badge variant="destructive" className="font-mono gap-1"><AlertTriangle className="size-3" />{r.violation_count as number}</Badge>
                                : <span className="text-xs text-green-600 dark:text-green-400">Clean</span>}
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
          )}

          {/* ── Rankings ── */}
          {tab === "rankings" && (
            <div className="mt-4 space-y-4">
              {!isPublished && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="flex items-center gap-3 py-4">
                    <Lock className="size-5 text-yellow-600 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Rankings are hidden from interns</p>
                      <p className="text-xs text-muted-foreground">Publish results to make ranks and scores visible.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {finalized.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Trophy className="size-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No completed attempts yet</h3>
                    <p className="text-muted-foreground">Rankings will appear once interns submit the quiz.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-yellow-500" />Rankings</CardTitle>
                    <CardDescription>Sorted by score (desc) · time spent (asc) as tiebreaker · passing score: {quiz.passingScore as number}%</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 pl-6">Rank</TableHead>
                          <TableHead>Intern</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                          <TableHead className="text-right">Violations</TableHead>
                          <TableHead className="text-right">Submitted</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {finalized.map((a, idx) => (
                          <TableRow key={a.id as string} className={idx === 0 ? "bg-yellow-500/5" : idx === 1 ? "bg-slate-500/5" : idx === 2 ? "bg-amber-600/5" : ""}>
                            <TableCell className="pl-6">
                              <RankCell rank={isPublished ? (a.rank as number | null) : (idx + 1)} isPublished={true} />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{a.intern_name as string}</p>
                              <p className="text-xs text-muted-foreground">{a.intern_email as string}</p>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{a.score != null ? `${a.score}/${a.totalPoints}` : "—"}</TableCell>
                            <TableCell className="text-right">
                              {a.percentage != null ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`font-semibold text-sm ${a.passed ? "text-green-600" : "text-red-500"}`}>{Math.round(Number(a.percentage))}%</span>
                                  <Progress value={Number(a.percentage)} className={`h-1 w-16 ${a.passed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`} />
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell><StatusBadge status={a.status as string} passed={a.passed as boolean | null} /></TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{a.timeSpentSeconds ? fmt(Number(a.timeSpentSeconds)) : "—"}</TableCell>
                            <TableCell className="text-right">
                              {Number(a.violation_count) > 0
                                ? <Badge variant="destructive" className="gap-1 font-mono"><AlertTriangle className="size-3" />{a.violation_count as number}</Badge>
                                : <span className="text-xs text-green-600 dark:text-green-400">Clean</span>}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {a.submittedAt ? <LocalTime date={a.submittedAt as string} fmt="MMM d, h:mm a" /> : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/admin/results/${a.id as string}`}>View</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {inProgress.length > 0 && (
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="size-4" /> Currently In Progress ({inProgress.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {inProgress.map((a) => <Badge key={a.id as string} variant="secondary">{a.intern_name as string}</Badge>)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bulk AI Feedback — only show when there are finalized attempts */}
              {finalized.length > 0 && effectiveQuizId && (
                <Card className="border-purple-500/20 bg-purple-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      ✨ Bulk AI Feedback
                    </CardTitle>
                    <CardDescription>
                      Generate feedback for all {finalized.length} student{finalized.length !== 1 ? "s" : ""} at once — one prompt, one paste.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BulkAiFeedbackPanel quizId={effectiveQuizId} studentCount={finalized.length} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Did Not Join ── */}
          {tab === "absent" && notJoined.length > 0 && (
            <div className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="size-5" /> Did Not Join ({notJoined.length})</CardTitle>
                  <CardDescription>These interns were assigned this quiz but never started it.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notJoined.map((i) => (
                        <TableRow key={i.id as string}>
                          <TableCell className="font-medium">{i.name as string}</TableCell>
                          <TableCell className="text-muted-foreground">{i.email as string}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
