import { notFound } from "next/navigation"
import Link from "next/link"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  User, 
  FileQuestion, 
  Clock, 
  Target, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar
} from "lucide-react"
import { format } from "date-fns"

async function getAttemptDetails(attemptId: string) {
  const [attempt] = await sql`
    SELECT 
      qa.*,
      u.name as intern_name,
      u.email as intern_email,
      q.title as quiz_title,
      q.description as quiz_description,
      q."passingScore" as passing_score,
      q."timeLimitMinutes" as time_limit
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    JOIN quizzes q ON qa."quizId" = q.id
    WHERE qa.id = ${attemptId}
  `

  if (!attempt) return null

  const answers = await sql`
    SELECT 
      a.*,
      q.text as question_text,
      q.points as question_points,
      so.text as selected_option_text,
      co.text as correct_option_text
    FROM answers a
    JOIN questions q ON a."questionId" = q.id
    LEFT JOIN options so ON a."selectedOptionId" = so.id
    LEFT JOIN options co ON co."questionId" = q.id AND co."isCorrect" = true
    WHERE a."attemptId" = ${attemptId}
    ORDER BY q."order" ASC
  `

  const violations = await sql`
    SELECT * FROM violations WHERE "attemptId" = ${attemptId} ORDER BY timestamp ASC
  `

  return { attempt, answers, violations }
}

const violationLabels: Record<string, string> = {
  TAB_SWITCH: "Tab Switch",
  FULLSCREEN_EXIT: "Exited Fullscreen",
  COPY_ATTEMPT: "Copy Attempt",
  PASTE_ATTEMPT: "Paste Attempt",
  RIGHT_CLICK: "Right Click",
  DEVTOOLS_OPEN: "DevTools Opened",
  WINDOW_BLUR: "Window Lost Focus",
  CONTEXT_MENU: "Context Menu",
}

export default async function AttemptDetailsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const data = await getAttemptDetails(attemptId)

  if (!data) {
    notFound()
  }

  const { attempt, answers, violations } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/results">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attempt Details</h1>
          <p className="text-muted-foreground">
            Detailed view of quiz attempt and proctoring data
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="size-5" />
              {attempt.quiz_title}
            </CardTitle>
            {attempt.quiz_description && (
              <CardDescription>{attempt.quiz_description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <span className="font-medium">{attempt.intern_name}</span>
              <span className="text-muted-foreground">({attempt.intern_email})</span>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant={attempt.passed ? "default" : "destructive"}
                  className={attempt.passed ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 w-fit" : "w-fit"}
                >
                  {attempt.passed ? (
                    <><CheckCircle className="mr-1 size-3" /> Passed</>
                  ) : (
                    <><XCircle className="mr-1 size-3" /> Failed</>
                  )}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Score</span>
                <span className="font-semibold text-lg">
                  {attempt.score}/{attempt.totalPoints} ({Math.round(attempt.percentage || 0)}%)
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Time Spent</span>
                <span className="font-medium">
                  {attempt.timeSpentSeconds 
                    ? `${Math.floor(attempt.timeSpentSeconds / 60)}m ${attempt.timeSpentSeconds % 60}s`
                    : "-"
                  }
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span className="font-medium">
                  {attempt.submittedAt 
                    ? format(new Date(attempt.submittedAt), "MMM d, yyyy h:mm a")
                    : "-"
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Violations
            </CardTitle>
            <CardDescription>
              {violations.length} violation{violations.length !== 1 ? "s" : ""} detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {violations.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="size-4" />
                <span>No violations detected</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {violations.map((violation) => (
                  <div key={violation.id} className="flex items-start gap-3 text-sm">
                    <AlertTriangle className="size-4 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium">{violationLabels[violation.type] || violation.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(violation.timestamp), "h:mm:ss a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Answers</CardTitle>
          <CardDescription>
            Question-by-question breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {answers.map((answer, index) => (
              <div key={answer.id} className="flex items-start gap-4 p-4 rounded-lg border">
                <div className={`flex items-center justify-center size-8 rounded-full text-sm font-medium ${
                  answer.isCorrect 
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400" 
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400"
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium mb-2">{answer.question_text}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Selected:</span>
                      <span className={answer.isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {answer.selected_option_text || "No answer"}
                      </span>
                    </div>
                    {!answer.isCorrect && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Correct:</span>
                        <span className="text-green-600 dark:text-green-400">{answer.correct_option_text}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={answer.isCorrect ? "default" : "secondary"}>
                    {answer.isCorrect ? `+${answer.question_points}` : "0"} pt{answer.question_points !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
