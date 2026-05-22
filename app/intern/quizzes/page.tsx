import Link from "next/link"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileQuestion, Clock, PlayCircle, CheckCircle } from "lucide-react"
import { formatDistanceToNow, isPast } from "date-fns"

async function getAssignedQuizzes(internId: string) {
  const quizzes = await sql`
    SELECT 
      qa.id as assignment_id,
      qa."dueDate",
      q.id as quiz_id,
      q.title,
      q.description,
      q."timeLimitMinutes",
      q."passingScore",
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id) as question_count,
      (
        SELECT json_agg(json_build_object(
          'id', qat.id,
          'status', qat.status,
          'percentage', qat.percentage,
          'passed', qat.passed
        ))
        FROM quiz_attempts qat 
        WHERE qat."quizId" = q.id AND qat."internId" = ${internId}
      ) as attempts
    FROM quiz_assignments qa
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa."internId" = ${internId}
    ORDER BY qa."dueDate" ASC NULLS LAST, qa."assignedAt" DESC
  `
  return quizzes
}

export default async function InternQuizzesPage() {
  const session = await auth()
  const quizzes = await getAssignedQuizzes(session!.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
        <p className="text-muted-foreground">
          View and take your assigned quizzes
        </p>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileQuestion className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No quizzes assigned</h3>
            <p className="text-muted-foreground text-center">
              You don&apos;t have any quizzes assigned yet. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const attempts = quiz.attempts || []
            const completedAttempt = attempts.find((a: { status: string }) => a.status === "SUBMITTED")
            const inProgressAttempt = attempts.find((a: { status: string }) => a.status === "IN_PROGRESS")
            const isOverdue = quiz.dueDate && isPast(new Date(quiz.dueDate))

            return (
              <Card key={quiz.assignment_id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{quiz.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {quiz.description || "No description provided"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {completedAttempt ? (
                      <Badge 
                        variant={completedAttempt.passed ? "default" : "destructive"}
                        className={completedAttempt.passed ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400" : ""}
                      >
                        <CheckCircle className="mr-1 size-3" />
                        {completedAttempt.passed ? "Passed" : "Failed"} - {Math.round(completedAttempt.percentage)}%
                      </Badge>
                    ) : inProgressAttempt ? (
                      <Badge variant="secondary">In Progress</Badge>
                    ) : isOverdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="outline">Not Started</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <FileQuestion className="size-3.5" />
                      {quiz.question_count} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {quiz.timeLimitMinutes} min
                    </span>
                  </div>
                  {quiz.dueDate && !completedAttempt && (
                    <p className={`text-sm mb-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                      Due {formatDistanceToNow(new Date(quiz.dueDate), { addSuffix: true })}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Passing score: {quiz.passingScore}%
                  </p>
                </CardContent>
                <div className="p-6 pt-0">
                  {completedAttempt ? (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/intern/history`}>
                        View Results
                      </Link>
                    </Button>
                  ) : (
                    <Button className="w-full" asChild>
                      <Link href={`/intern/quizzes/${quiz.quiz_id}`}>
                        <PlayCircle className="mr-2 size-4" />
                        {inProgressAttempt ? "Continue Quiz" : "Start Quiz"}
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
