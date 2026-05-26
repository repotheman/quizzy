import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle, Clock, FileQuestion, Lock } from "lucide-react"
import { StartExamButton } from "./start-exam-button"
import { format } from "date-fns"

async function getQuizDetails(quizId: string, internId: string) {
  const quizzes = await sql`
    SELECT 
      q.id,
      q.title,
      q.description,
      q."timeLimitMinutes",
      q."passingScore",
      COALESCE(q."maxViolations", 3) as "maxViolations",
      qa."startAt",
      qa."endAt",
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id) as question_count,
      CASE WHEN qa."startAt" IS NOT NULL THEN NOW() < qa."startAt" ELSE false END AS "notStartedYet",
      CASE WHEN qa."endAt"   IS NOT NULL THEN NOW() > qa."endAt"   ELSE false END AS "endedAlready"
    FROM quizzes q
    JOIN quiz_assignments qa ON qa."quizId" = q.id
    WHERE q.id = ${quizId}
    AND qa."internId" = ${internId}
    AND q."isPublished" = true
  `
  return quizzes[0] || null
}

async function getExistingAttempt(quizId: string, internId: string) {
  const attempts = await sql`
    SELECT id, status FROM quiz_attempts
    WHERE "quizId" = ${quizId}
    AND "internId" = ${internId}
    ORDER BY "startedAt" DESC
    LIMIT 1
  `
  return attempts[0] || null
}

export default async function PreExamPage({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "INTERN") {
    redirect("/login")
  }

  const { quizId } = await params
  const quiz = await getQuizDetails(quizId, session.user.id)

  if (!quiz) {
    redirect("/intern/quizzes")
  }

  const existingAttempt = await getExistingAttempt(quizId, session.user.id)

  if (existingAttempt && existingAttempt.status !== "IN_PROGRESS") {
    redirect("/intern/history")
  }

  const now = new Date()
  const startsAt = quiz.startAt ? new Date(quiz.startAt) : null
  const endsAt = quiz.endAt ? new Date(quiz.endAt) : null
  const notStartedYet = quiz.notStartedYet
  const endedAlready = quiz.endedAlready
  const availabilityReason = notStartedYet
    ? "This quiz has not started yet."
    : endedAlready
    ? "This quiz deadline has passed and it can no longer be started."
    : existingAttempt && existingAttempt.status !== "IN_PROGRESS"
    ? "You already completed this quiz. View your results in history."
    : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{quiz.title}</CardTitle>
          <CardDescription className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {quiz.timeLimitMinutes} minutes
            </span>
            <span className="flex items-center gap-1">
              <FileQuestion className="size-4" />
              {quiz.question_count} questions
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Proctored Examination</AlertTitle>
            <AlertDescription>
              This is a proctored exam. Any attempt to cheat will result in automatic disqualification.
            </AlertDescription>
          </Alert>

          <div>
            <h3 className="font-semibold mb-3">Exam Rules</h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>You have <strong className="text-foreground">{quiz.timeLimitMinutes} minutes</strong> to complete this exam. The timer starts when you click Start.</li>
              <li>The exam runs in <strong className="text-foreground">fullscreen mode</strong>. Exiting fullscreen counts as a violation.</li>
              <li><strong className="text-foreground">Switching tabs or windows</strong> counts as a violation.</li>
              <li><strong className="text-foreground">Copy, paste, right-click, and keyboard shortcuts</strong> are disabled.</li>
              <li>AI tools and external resources are <strong className="text-foreground">strictly prohibited</strong>.</li>
              <li>All violations are logged and visible to administrators.</li>
              <li>The quiz can only be attempted <strong className="text-foreground">once</strong>.</li>
            </ol>
          </div>

          {(startsAt || endsAt) && (
            <Alert variant={notStartedYet || endedAlready ? "destructive" : "default"}>
              <Lock className="size-4" />
              <AlertTitle>Availability Window</AlertTitle>
              <AlertDescription>
                {startsAt && <p>Starts: {format(startsAt, "PPpp")}</p>}
                {endsAt && <p>Ends: {format(endsAt, "PPpp")}</p>}
                {availabilityReason && <p>{availabilityReason}</p>}
              </AlertDescription>
            </Alert>
          )}

          {existingAttempt && existingAttempt.status !== "IN_PROGRESS" ? (
            <Alert>
              <CheckCircle className="size-4" />
              <AlertTitle>Already Completed</AlertTitle>
              <AlertDescription>
                You have already completed this quiz. You can review the result from your history page.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="text-sm text-muted-foreground">
            <p>Passing score: <strong className="text-foreground">{quiz.passingScore}%</strong></p>
          </div>

          <Separator />

          <StartExamButton 
            quizId={quizId} 
            hasInProgressAttempt={existingAttempt?.status === "IN_PROGRESS"}
            attemptId={existingAttempt?.id}
            isLocked={notStartedYet || endedAlready || (existingAttempt && existingAttempt.status !== "IN_PROGRESS")}
            unavailableReason={availabilityReason || undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
