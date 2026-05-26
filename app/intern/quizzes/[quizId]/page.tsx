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
  const [row] = await sql`
    SELECT
      q.id,
      q.title,
      q.description,
      q."timeLimitMinutes",
      q."passingScore",
      q."maxViolations",
      qa."startAt",
      qa."endAt",
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id)        AS question_count,
      CASE WHEN qa."startAt" IS NOT NULL THEN NOW() < qa."startAt" ELSE false END AS not_started_yet,
      CASE WHEN qa."endAt"   IS NOT NULL THEN NOW() > qa."endAt"   ELSE false END AS window_closed
    FROM quizzes q
    JOIN quiz_assignments qa ON qa."quizId" = q.id
    WHERE q.id          = ${quizId}
    AND   qa."internId" = ${internId}
    AND   q."isPublished" = true
  `
  return row ?? null
}

async function getExistingAttempt(quizId: string, internId: string) {
  const [row] = await sql`
    SELECT id, status FROM quiz_attempts
    WHERE "quizId"   = ${quizId}
    AND   "internId" = ${internId}
    LIMIT 1
  `
  return row ?? null
}

export default async function PreExamPage({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "INTERN") redirect("/login")

  const { quizId } = await params
  const quiz = await getQuizDetails(quizId, session.user.id)
  if (!quiz) redirect("/intern/quizzes")

  const existingAttempt = await getExistingAttempt(quizId, session.user.id)

  // Already completed — send to history
  if (existingAttempt && existingAttempt.status !== "IN_PROGRESS") {
    redirect("/intern/history")
  }

  const notStartedYet = Boolean(quiz.not_started_yet)
  const windowClosed  = Boolean(quiz.window_closed)
  const startsAt      = quiz.startAt ? new Date(quiz.startAt) : null
  const endsAt        = quiz.endAt   ? new Date(quiz.endAt)   : null

  const unavailableReason = notStartedYet
    ? "This quiz has not started yet. Come back after the open time."
    : windowClosed
    ? "The join window has closed. You can no longer start this quiz."
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
              <li>You have <strong className="text-foreground">{quiz.timeLimitMinutes} minutes</strong> from when you click Start.</li>
              <li>The exam runs in <strong className="text-foreground">fullscreen mode</strong>. Exiting fullscreen counts as a violation.</li>
              <li><strong className="text-foreground">Switching tabs or windows</strong> counts as a violation.</li>
              <li><strong className="text-foreground">Copy, paste, right-click, and keyboard shortcuts</strong> are disabled.</li>
              <li>AI tools and external resources are <strong className="text-foreground">strictly prohibited</strong>.</li>
              <li>After <strong className="text-foreground">{quiz.maxViolations} violations</strong>, your exam will be automatically terminated.</li>
              <li>The quiz can only be attempted <strong className="text-foreground">once</strong>.</li>
            </ol>
          </div>

          {/* Join window */}
          {(startsAt || endsAt) && (
            <Alert variant={notStartedYet || windowClosed ? "destructive" : "default"}>
              <Lock className="size-4" />
              <AlertTitle>Join Window</AlertTitle>
              <AlertDescription className="space-y-1">
                {startsAt && <p>Opens: {format(startsAt, "PPpp")}</p>}
                {endsAt   && <p>Join by: {format(endsAt, "PPpp")}</p>}
                {unavailableReason && <p className="font-medium mt-1">{unavailableReason}</p>}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">
            Passing score: <strong className="text-foreground">{quiz.passingScore}%</strong>
          </p>

          <Separator />

          <StartExamButton
            quizId={quizId}
            hasInProgressAttempt={existingAttempt?.status === "IN_PROGRESS"}
            attemptId={existingAttempt?.id}
            isLocked={notStartedYet || windowClosed}
            unavailableReason={unavailableReason ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
