"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface QuizFormData {
  title: string
  description: string
  timeLimitMinutes: number
  passingScore: number
  shuffleQuestions: boolean
}

interface QuizFormProps {
  initialData?: QuizFormData & { id?: string; isPublished?: boolean }
  mode: "create" | "edit"
}

export function QuizForm({ initialData, mode }: QuizFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<QuizFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    timeLimitMinutes: initialData?.timeLimitMinutes || 30,
    passingScore: initialData?.passingScore || 70,
    shuffleQuestions: initialData?.shuffleQuestions || false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const url = mode === "create" 
        ? "/api/admin/quizzes" 
        : `/api/admin/quizzes/${initialData?.id}`
      
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save quiz")
      }

      toast.success(mode === "create" ? "Quiz created successfully" : "Quiz updated successfully")
      
      if (mode === "create") {
        router.push(`/admin/quizzes/${data.id}/edit`)
      } else {
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save quiz")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/quizzes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "create" ? "Create Quiz" : "Edit Quiz"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "create" 
              ? "Set up your quiz details, then add questions" 
              : "Update your quiz settings"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
            <CardDescription>
              Basic information about your quiz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., JavaScript Fundamentals"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this quiz covers..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeLimitMinutes">Time Limit (minutes)</Label>
                <Input
                  id="timeLimitMinutes"
                  type="number"
                  min={1}
                  max={180}
                  value={formData.timeLimitMinutes}
                  onChange={(e) => setFormData({ ...formData, timeLimitMinutes: parseInt(e.target.value) || 30 })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passingScore">Passing Score (%)</Label>
                <Input
                  id="passingScore"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.passingScore}
                  onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) || 70 })}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="shuffleQuestions" className="font-medium">
                  Shuffle Questions
                </Label>
                <p className="text-sm text-muted-foreground">
                  Randomize the order of questions for each attempt
                </p>
              </div>
              <Switch
                id="shuffleQuestions"
                checked={formData.shuffleQuestions}
                onCheckedChange={(checked) => setFormData({ ...formData, shuffleQuestions: checked })}
                disabled={isLoading}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              💡 After creating the quiz, you can add questions manually or import them in bulk via JSON/CSV. When you publish the quiz, you&apos;ll be able to assign it to interns.
            </p>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/quizzes">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {mode === "create" ? "Create & Add Questions" : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
