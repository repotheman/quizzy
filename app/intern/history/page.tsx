import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { History, Clock, Target, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
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
      qa.violations,
      qa."autoSubmitted",
      qa."startedAt",
      qa."submittedAt",
      qa."timeSpentSeconds",
      q.title                                                        AS quiz_title,
      q."passingScore"                                               AS passing_score,
      q."resultsPublishedAt"                                         AS results_published_at,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id)   AS violation_count
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa."quizId"
    WHERE qa."internId" = ${internId}
    AND   qa.status    != 'IN_PROGRESS'
    ORDER BY qa."startedAt" DESC
  `
}

export default async function HistoryPage() {
  const session = await auth()
  const attempts = await getAttemptHistory(session!.user.id)

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
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
            <CardDescription>
              {attempts.length} attempt{attempts.length !== 1 ? "s" : ""} recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Time Spent</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  // Results are hidden until admin publishes them
                  const resultsHidden = !attempt.results_published_at

                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">{attempt.quiz_title}</TableCell>

                      {/* Status */}
                      <TableCell>
                        {attempt.status === "TERMINATED" ? (
                          <Badge variant="destructive">Terminated</Badge>
                        ) : attempt.status === "TIMED_OUT" ? (
                          <Badge variant="destructive">Timed Out</Badge>
                        ) : resultsHidden ? (
                          <Badge variant="outline">
                            <Clock className="mr-1 size-3" />
                            Pending Results
                          </Badge>
                        ) : attempt.passed ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle className="mr-1 size-3" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            <XCircle className="mr-1 size-3" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>

                      {/* Score */}
                      <TableCell>
                        {resultsHidden ? (
                          <span className="text-muted-foreground italic text-sm">Hidden</span>
                        ) : attempt.percentage !== null ? (
                          <div className="flex items-center gap-1">
                            <Target className="size-3.5 text-muted-foreground" />
                            <span className={attempt.passed ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                              {Math.round(attempt.percentage)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({attempt.score}/{attempt.totalPoints})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Rank */}
                      <TableCell>
                        {resultsHidden ? (
                          <span className="text-muted-foreground italic text-sm">Hidden</span>
                        ) : attempt.rank ? (
                          <span className="font-mono font-medium">#{attempt.rank}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Time spent */}
                      <TableCell>
                        {attempt.timeSpentSeconds
                          ? `${Math.floor(attempt.timeSpentSeconds / 60)}m ${attempt.timeSpentSeconds % 60}s`
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>

                      {/* Violations */}
                      <TableCell>
                        {Number(attempt.violation_count) > 0 ? (
                          <Badge variant="destructive" className="font-mono">
                            <AlertTriangle className="mr-1 size-3" />
                            {attempt.violation_count}
                          </Badge>
                        ) : (
                          <span className="text-green-600 dark:text-green-400 text-sm">Clean</span>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(attempt.startedAt), "MMM d, yyyy h:mm a")}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
