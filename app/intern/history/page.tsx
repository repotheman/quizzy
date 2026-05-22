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
  TableRow 
} from "@/components/ui/table"
import { History, Clock, Target, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

async function getAttemptHistory(internId: string) {
  const attempts = await sql`
    SELECT 
      qa.*,
      q.title as quiz_title,
      q."passingScore" as passing_score,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id) as violation_count
    FROM quiz_attempts qa
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa."internId" = ${internId}
    ORDER BY qa."startedAt" DESC
  `
  return attempts
}

export default async function HistoryPage() {
  const session = await auth()
  const attempts = await getAttemptHistory(session!.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">
          View your past quiz attempts and results
        </p>
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
                  <TableHead>Time</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">{attempt.quiz_title}</TableCell>
                    <TableCell>
                      {attempt.status === "SUBMITTED" ? (
                        attempt.passed ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle className="mr-1 size-3" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            <XCircle className="mr-1 size-3" />
                            Failed
                          </Badge>
                        )
                      ) : attempt.status === "IN_PROGRESS" ? (
                        <Badge variant="secondary">
                          <Clock className="mr-1 size-3" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          {attempt.status === "TIMED_OUT" ? "Timed Out" : "Terminated"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {attempt.percentage !== null ? (
                        <div className="flex items-center gap-1">
                          <Target className="size-3.5 text-muted-foreground" />
                          <span className={attempt.passed ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                            {Math.round(attempt.percentage)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {attempt.timeSpentSeconds ? (
                        <span>{Math.floor(attempt.timeSpentSeconds / 60)}m {attempt.timeSpentSeconds % 60}s</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {attempt.violation_count > 0 ? (
                        <Badge variant="destructive" className="font-mono">
                          <AlertTriangle className="mr-1 size-3" />
                          {attempt.violation_count}
                        </Badge>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 text-sm">Clean</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(attempt.startedAt), "MMM d, yyyy h:mm a")}
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
