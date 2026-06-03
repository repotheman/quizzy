import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileQuestion, Clock, PlayCircle, CheckCircle } from "lucide-react"
import { format } from "date-fns"

async function getAssignedQuizzes(internId: string) {
  return sql`
    SELECT
      qa.id                                                          AS assignment_id,
      qa."startAt",
      qa."endAt",
      q.id                                                           AS quiz_id,
      q.title,
      q.description,
      q."timeLimitMinutes",
      q."passingScore",
      q."resultsPublishedAt",
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id)        AS question_count,
      CASE WHEN qa."startAt" IS NOT NULL THEN NOW() < qa."startAt" ELSE false END AS not_started_yet,
      CASE WHEN qa."endAt"   IS NOT NULL THEN NOW() > qa."endAt"   ELSE false END AS window_closed,
      (
        SELECT json_build_object(
          'id',         qat.id,
          'status',     qat.status,
          'percentage', qat.percentage,
          'passed',     qat.passed
        )
        FROM quiz_attempts qat
        WHERE qat."quizId" = q.id AND qat."internId" = ${internId}
        ORDER BY qat."startedAt" DESC
        LIMIT 1
      ) AS attempt
    FROM quiz_assignments qa
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa."internId" = ${internId}
    AND q."isPublished" = true
    ORDER BY qa."endAt" ASC NULLS LAST, qa."assignedAt" DESC
  `
}

export default async function InternQuizzesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const quizzes = await getAssignedQuizzes(session.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
        <p className="text-muted-foreground">View and take your assigned quizzes</p>
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
            const attempt        = quiz.attempt as { id: string; status: string; percentage: number; passed: boolean } | null
            const isCompleted    = attempt && attempt.status !== "IN_PROGRESS"
            const isInProgress   = attempt?.status === "IN_PROGRESS"
            const notStartedYet  = Boolean(quiz.not_started_yet)
            const windowClosed   = Boolean(quiz.window_closed)
            // Results are hidden until admin publishes them
            const resultsHidden  = isCompleted && !quiz.resultsPublishedAt
            const startsAt       = quiz.startAt ? new Date(quiz.startAt) : null
            const endsAt         = quiz.endAt   ? new Date(quiz.endAt)   : null
            const isUnavailable  = notStartedYet || windowClosed

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

                  {/* Status badge */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {isCompleted ? (
                      resultsHidden ? (
                        <Badge variant="outline">
                          <Clock className="mr-1 size-3" />
                          Completed — Results Pending
                        </Badge>
                      ) : (
                        <Badge
                          variant={attempt!.passed ? "default" : "destructive"}
                          className={attempt!.passed ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400" : ""}
                        >
                          <CheckCircle className="mr-1 size-3" />
                          {attempt!.passed ? "Passed" : "Failed"} — {Math.round(attempt!.percentage)}%
                        </Badge>
                      )
                    ) : isInProgress ? (
                      <Badge variant="secondary">In Progress</Badge>
                    ) : windowClosed ? (
                      <Badge variant="destructive">Window Closed</Badge>
                    ) : notStartedYet ? (
                      <Badge variant="outline">Not Open Yet</Badge>
                    ) : (
                      <Badge variant="outline">Not Started</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileQuestion className="size-3.5" />
                      {quiz.question_count} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {quiz.timeLimitMinutes} min
                    </span>
                  </div>

                  {/* Join window info */}
                  {(startsAt || endsAt) && (
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      {startsAt && <p>Opens: {format(startsAt, "PPpp")}</p>}
                      {endsAt   && <p>Join by: {format(endsAt, "PPpp")}</p>}
                    </div>
                  )}

                  {!isCompleted && isUnavailable && (
                    <Alert>
                      <AlertTitle>
                        {windowClosed ? "Join window closed" : "Not open yet"}
                      </AlertTitle>
                      <AlertDescription>
                        {windowClosed
                          ? "The join window has closed. You can no longer start this quiz."
                          : "This quiz will open later. Come back after the start time."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Passing score: <strong className="text-foreground">{quiz.passingScore}%</strong>
                  </p>
                </CardContent>

                <div className="p-6 pt-0">
                  {isCompleted ? (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/intern/history">
                        {resultsHidden ? "View Attempt" : "View Results"}
                      </Link>
                    </Button>
                  ) : isUnavailable ? (
                    <Button className="w-full" disabled variant="secondary">
                      {windowClosed ? "Window Closed" : "Not Open Yet"}
                    </Button>
                  ) : (
                    <Button className="w-full" asChild>
                      <Link href={`/intern/quizzes/${quiz.quiz_id}`}>
                        <PlayCircle className="mr-2 size-4" />
                        {isInProgress ? "Continue Quiz" : "Start Quiz"}
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
