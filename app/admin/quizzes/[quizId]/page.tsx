import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Clock, Target, Check, X, Radio } from "lucide-react"

async function getQuizWithQuestions(quizId: string, adminId: string) {
  const [quiz] = (await sql`
    SELECT * FROM quizzes WHERE id = ${quizId} AND "createdById" = ${adminId}
  `) as any[]

  if (!quiz) return null

  const questions = (await sql`
    SELECT * FROM questions WHERE "quizId" = ${quizId} ORDER BY "order" ASC
  `) as any[]

  const questionsWithOptions = await Promise.all(
    questions.map(async (question: any) => {
      const options = (await sql`
        SELECT * FROM options WHERE "questionId" = ${question.id} ORDER BY "order" ASC
      `) as any[]
      return { ...question, options }
    })
  )

  return { ...quiz, questions: questionsWithOptions }
}

export default async function ViewQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const session = await auth()
  const { quizId } = await params
  const quiz = await getQuizWithQuestions(quizId, session!.user.id)

  if (!quiz) {
    notFound()
  }

  const totalPoints = quiz.questions.reduce((sum: number, q: { points: number }) => sum + q.points, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/quizzes">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{quiz.title}</h1>
              <Badge variant={quiz.isPublished ? "default" : "secondary"}>
                {quiz.isPublished ? "Published" : "Draft"}
              </Badge>
            </div>
            {quiz.description && (
              <p className="text-muted-foreground mt-1">{quiz.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/quizzes/${quiz.id}/attendance`}>
              <Radio className="mr-2 size-4" />
              Live Attendance
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/quizzes/${quiz.id}/edit`}>
              <Pencil className="mr-2 size-4" />
              Edit Quiz
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Questions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{quiz.questions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Points</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="size-3.5" /> Time Limit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{quiz.timeLimitMinutes} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="size-3.5" /> Passing Score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{quiz.passingScore}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>
            Preview of all questions in this quiz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {quiz.questions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No questions in this quiz yet.
            </p>
          ) : (
            quiz.questions.map((question: { id: string; text: string; type: string; points: number; options: { id: string; text: string; isCorrect: boolean }[] }, index: number) => (
              <div key={question.id} className="border-b pb-6 last:border-0 last:pb-0">
                <div className="flex items-start gap-4">
                  <span className="flex items-center justify-center size-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="font-medium">{question.text}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {question.type === "MCQ" ? "Multiple Choice" : "True/False"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {question.points} pt{question.points !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      {question.options.map((option: { id: string; text: string; isCorrect: boolean }, optIndex: number) => (
                        <div
                          key={option.id}
                          className={`flex items-center gap-2 text-sm p-2.5 rounded-md ${
                            option.isCorrect 
                              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" 
                              : "bg-muted/50"
                          }`}
                        >
                          {option.isCorrect ? (
                            <Check className="size-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <X className="size-4 text-muted-foreground" />
                          )}
                          <span className={option.isCorrect ? "text-green-700 dark:text-green-400 font-medium" : ""}>
                            {String.fromCharCode(65 + optIndex)}. {option.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
