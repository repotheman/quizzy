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
import { Users, Mail, Calendar } from "lucide-react"
import { format } from "date-fns"
import { AssignQuizButton } from "./assign-quiz-button"

async function getInterns() {
  const interns = await sql`
    SELECT 
      u.*,
      (SELECT COUNT(*) FROM quiz_assignments WHERE "internId" = u.id) as assignments_count,
      (SELECT COUNT(*) FROM quiz_attempts WHERE "internId" = u.id AND status = 'SUBMITTED') as completed_count
    FROM users u
    WHERE u.role = 'INTERN'
    ORDER BY u."createdAt" DESC
  `
  return interns
}

async function getPublishedQuizzes() {
  const quizzes = await sql`
    SELECT id, title FROM quizzes WHERE "isPublished" = true ORDER BY title ASC
  `
  return quizzes
}

export default async function InternsPage() {
  const interns = await getInterns()
  const quizzes = await getPublishedQuizzes()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interns</h1>
          <p className="text-muted-foreground">
            Manage your interns and assign quizzes
          </p>
        </div>
      </div>

      {interns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No interns yet</h3>
            <p className="text-muted-foreground text-center">
              Interns will appear here once they register on the platform.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Interns</CardTitle>
            <CardDescription>
              {interns.length} intern{interns.length !== 1 ? "s" : ""} registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interns.map((intern) => (
                  <TableRow key={intern.id}>
                    <TableCell className="font-medium">{intern.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="size-3.5" />
                        {intern.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="size-3.5" />
                        {format(new Date(intern.createdAt), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{intern.assignments_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{intern.completed_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AssignQuizButton 
                        internId={intern.id} 
                        internName={intern.name}
                        quizzes={quizzes}
                      />
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
