import Link from "next/link"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FileQuestion, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle } from "lucide-react"
import { format, isPast, formatDistanceToNow } from "date-fns"

async function getInternStats(internId: string) {
  const [assignedCount] = await sql`
    SELECT COUNT(*) as count FROM quiz_assignments WHERE "internId" = ${internId}
  `
  const [completedCount] = await sql`
    SELECT COUNT(*) as count FROM quiz_attempts WHERE "internId" = ${internId} AND status != 'IN_PROGRESS'
  `
  // Use DB NOW() to avoid server clock skew
  const [passedCount] = await sql`
    SELECT COUNT(*) as count FROM quiz_attempts
    WHERE "internId" = ${internId} AND status != 'IN_PROGRESS' AND passed = true
  `
  const [avgScore] = await sql`
    SELECT COALESCE(AVG(percentage), 0) as avg FROM quiz_attempts
    WHERE "internId" = ${internId} AND status != 'IN_PROGRESS'
  `

  return {
    assigned: Number(assignedCount.count),
    completed: Number(completedCount.count),
    passed: Number(passedCount.count),
    averageScore: Math.round(Number(avgScore.avg)),
  }
}

async function getPendingQuizzes(internId: string) {
  const quizzes = await sql`
    SELECT 
      qa.id as assignment_id,
      qa."dueDate",
      q.id as quiz_id,
      q.title,
      q.description,
      q."timeLimitMinutes",
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id) as question_count,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "quizId" = q.id AND "internId" = ${internId}) as attempt_count
    FROM quiz_assignments qa
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa."internId" = ${internId}
    AND q."isPublished" = true
    AND NOT EXISTS (
      SELECT 1 FROM quiz_attempts 
      WHERE "quizId" = q.id AND "internId" = ${internId} AND status != 'IN_PROGRESS'
    )
    ORDER BY qa."dueDate" ASC NULLS LAST
    LIMIT 3
  `
  return quizzes
}

export default async function InternDashboard() {
  const session = await auth()
  const stats = await getInternStats(session!.user.id)
  const pendingQuizzes = await getPendingQuizzes(session!.user.id)

  const completionRate = stats.assigned > 0 
    ? Math.round((stats.completed / stats.assigned) * 100) 
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}. Here&apos;s your progress overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Quizzes</CardTitle>
            <FileQuestion className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assigned}</div>
            <p className="text-xs text-muted-foreground">
              Total quizzes assigned to you
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completed > 0 
                ? `${Math.round((stats.passed / stats.completed) * 100)}% pass rate`
                : "No completed quizzes yet"
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <AlertCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              Across all attempts
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Quizzes</CardTitle>
              <CardDescription>
                Quizzes that need your attention
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/intern/quizzes">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingQuizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="size-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">
                You have no pending quizzes at the moment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingQuizzes.map((quiz) => {
                const isOverdue = quiz.dueDate && isPast(new Date(quiz.dueDate))
                const hasInProgress = quiz.attempt_count > 0

                return (
                  <div
                    key={quiz.assignment_id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{quiz.title}</p>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                        {hasInProgress && (
                          <Badge variant="secondary" className="text-xs">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileQuestion className="size-3.5" />
                          {quiz.question_count} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {quiz.timeLimitMinutes} min
                        </span>
                        {quiz.dueDate && (
                          <span className={isOverdue ? "text-destructive" : ""}>
                            Due {formatDistanceToNow(new Date(quiz.dueDate), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button asChild>
                      <Link href={`/intern/quizzes/${quiz.quiz_id}`}>
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
