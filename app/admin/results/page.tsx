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
import { ClipboardList, Clock, Target, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { Button } from "@/components/ui/button"

async function getResults() {
  const results = await sql`
    SELECT 
      qa.*,
      u.name as intern_name,
      u.email as intern_email,
      q.title as quiz_title,
      q."passingScore" as passing_score,
      (SELECT COUNT(*) FROM violations WHERE "attemptId" = qa.id) as violation_count
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    JOIN quizzes q ON qa."quizId" = q.id
    ORDER BY qa."startedAt" DESC
  `
  return results
}

function getStatusBadge(status: string, passed: boolean | null) {
  switch (status) {
    case "SUBMITTED":
      return passed ? (
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
    case "IN_PROGRESS":
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 size-3" />
          In Progress
        </Badge>
      )
    case "TIMED_OUT":
      return (
        <Badge variant="destructive">
          <Clock className="mr-1 size-3" />
          Timed Out
        </Badge>
      )
    case "TERMINATED":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="mr-1 size-3" />
          Terminated
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default async function ResultsPage() {
  const results = await getResults()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="text-muted-foreground">
          View all quiz attempt results and proctoring data
        </p>
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results yet</h3>
            <p className="text-muted-foreground text-center">
              Results will appear here once interns complete their assigned quizzes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Attempts</CardTitle>
            <CardDescription>
              {results.length} attempt{results.length !== 1 ? "s" : ""} recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intern</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{result.intern_name}</p>
                        <p className="text-sm text-muted-foreground">{result.intern_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{result.quiz_title}</TableCell>
                    <TableCell>{getStatusBadge(result.status, result.passed)}</TableCell>
                    <TableCell>
                      {result.percentage !== null ? (
                        <div className="flex items-center gap-1">
                          <Target className="size-3.5 text-muted-foreground" />
                          <span className={result.passed ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                            {Math.round(result.percentage)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.timeSpentSeconds ? (
                        <span>{Math.floor(result.timeSpentSeconds / 60)}m {result.timeSpentSeconds % 60}s</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.violation_count > 0 ? (
                        <Badge variant="destructive" className="font-mono">
                          <AlertTriangle className="mr-1 size-3" />
                          {result.violation_count}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 dark:text-green-400">
                          <CheckCircle className="mr-1 size-3" />
                          Clean
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(result.startedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/results/${result.id}`}>
                          View Details
                        </Link>
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
