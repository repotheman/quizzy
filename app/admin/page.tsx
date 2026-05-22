import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileQuestion, Users, ClipboardCheck, TrendingUp } from "lucide-react"

async function getAdminStats() {
  const [quizCount] = await sql`SELECT COUNT(*) as count FROM quizzes`
  const [internCount] = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'INTERN'`
  const [attemptCount] = await sql`SELECT COUNT(*) as count FROM quiz_attempts WHERE status = 'SUBMITTED'`
  const [avgScore] = await sql`SELECT COALESCE(AVG(percentage), 0) as avg FROM quiz_attempts WHERE status = 'SUBMITTED'`
  
  return {
    totalQuizzes: Number(quizCount.count),
    totalInterns: Number(internCount.count),
    completedAttempts: Number(attemptCount.count),
    averageScore: Math.round(Number(avgScore.avg)),
  }
}

async function getRecentActivity() {
  const activities = await sql`
    SELECT 
      qa.id,
      qa.status,
      qa."submittedAt",
      qa.percentage,
      qa.passed,
      u.name as intern_name,
      q.title as quiz_title
    FROM quiz_attempts qa
    JOIN users u ON qa."internId" = u.id
    JOIN quizzes q ON qa."quizId" = q.id
    ORDER BY COALESCE(qa."submittedAt", qa."startedAt") DESC
    LIMIT 5
  `
  return activities
}

export default async function AdminDashboard() {
  const session = await auth()
  const stats = await getAdminStats()
  const recentActivity = await getRecentActivity()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}. Here&apos;s an overview of your platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <FileQuestion className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuizzes}</div>
            <p className="text-xs text-muted-foreground">
              Quizzes created
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interns</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInterns}</div>
            <p className="text-xs text-muted-foreground">
              Registered interns
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Attempts</CardTitle>
            <ClipboardCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedAttempts}</div>
            <p className="text-xs text-muted-foreground">
              Quiz submissions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
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
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest quiz attempts from your interns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No quiz attempts yet. Assign quizzes to your interns to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{activity.intern_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.quiz_title}
                    </p>
                  </div>
                  <div className="text-right">
                    {activity.status === "SUBMITTED" ? (
                      <>
                        <p className={`text-sm font-medium ${activity.passed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {activity.percentage}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.passed ? "Passed" : "Failed"}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground capitalize">
                        {activity.status.toLowerCase().replace("_", " ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
