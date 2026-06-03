export const dynamic = 'force-dynamic'

import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, FileQuestion, Clock, Target, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteQuizButton } from "./delete-quiz-button"

async function getQuizzes(adminId: string) {
  const quizzes = await sql`
    SELECT 
      q.*,
      (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id) as question_count,
      (SELECT COUNT(*) FROM quiz_assignments WHERE "quizId" = q.id) as assignment_count
    FROM quizzes q
    WHERE q."createdById" = ${adminId}
    ORDER BY q."createdAt" DESC
  `
  return quizzes
}

export default async function QuizzesPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login")
  const quizzes = await getQuizzes(session.user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-muted-foreground">
            Create and manage your assessment quizzes
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/quizzes/new">
            <Plus className="mr-2 size-4" />
            Create Quiz
          </Link>
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileQuestion className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first quiz for your interns.
            </p>
            <Button asChild>
              <Link href="/admin/quizzes/new">
                <Plus className="mr-2 size-4" />
                Create Quiz
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 pr-8">
                    <CardTitle className="text-lg line-clamp-1">{quiz.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {quiz.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 absolute top-4 right-4">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/quizzes/${quiz.id}`}>
                          <Eye className="mr-2 size-4" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/quizzes/${quiz.id}/edit`}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DeleteQuizButton quizId={quiz.id} quizTitle={quiz.title} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant={quiz.isPublished ? "default" : "secondary"}>
                    {quiz.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant="outline">
                    {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    <span>{quiz.timeLimitMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="size-3.5" />
                    <span>{quiz.passingScore}% to pass</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {quiz.assignment_count} intern{quiz.assignment_count !== 1 ? "s" : ""} assigned
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
