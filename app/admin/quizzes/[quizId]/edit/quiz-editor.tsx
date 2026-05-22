"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Loader2, 
  GripVertical,
  Pencil,
  Save,
  Eye,
  Check,
  X
} from "lucide-react"
import type { Quiz, Question, Option, QuestionType } from "@/lib/db"

interface QuestionWithOptions extends Question {
  options: Option[]
}

interface QuizWithQuestions extends Quiz {
  questions: QuestionWithOptions[]
}

interface QuizEditorProps {
  quiz: QuizWithQuestions
}

interface QuestionFormData {
  type: QuestionType
  text: string
  points: number
  options: { text: string; isCorrect: boolean }[]
}

const defaultQuestionForm: QuestionFormData = {
  type: "MCQ",
  text: "",
  points: 1,
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
}

export function QuizEditor({ quiz: initialQuiz }: QuizEditorProps) {
  const router = useRouter()
  const [quiz, setQuiz] = useState(initialQuiz)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  
  // Question dialog state
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithOptions | null>(null)
  const [questionForm, setQuestionForm] = useState<QuestionFormData>(defaultQuestionForm)
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false)
  
  // Delete confirmation
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null)
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)

  // Settings form
  const [settings, setSettings] = useState({
    title: quiz.title,
    description: quiz.description || "",
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingScore: quiz.passingScore,
    shuffleQuestions: quiz.shuffleQuestions,
  })

  async function handleSaveSettings() {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) throw new Error("Failed to save")

      toast.success("Settings saved")
      router.refresh()
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublishToggle() {
    setIsPublishing(true)
    try {
      const newPublishedState = !quiz.isPublished
      
      if (newPublishedState && quiz.questions.length === 0) {
        toast.error("Cannot publish a quiz with no questions")
        return
      }

      const response = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: newPublishedState }),
      })

      if (!response.ok) throw new Error("Failed to update")

      setQuiz({ ...quiz, isPublished: newPublishedState })
      toast.success(newPublishedState ? "Quiz published" : "Quiz unpublished")
    } catch {
      toast.error("Failed to update publish status")
    } finally {
      setIsPublishing(false)
    }
  }

  function openAddQuestion() {
    setEditingQuestion(null)
    setQuestionForm(defaultQuestionForm)
    setQuestionDialogOpen(true)
  }

  function openEditQuestion(question: QuestionWithOptions) {
    setEditingQuestion(question)
    setQuestionForm({
      type: question.type,
      text: question.text,
      points: question.points,
      options: question.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
    })
    setQuestionDialogOpen(true)
  }

  function handleQuestionTypeChange(type: QuestionType) {
    if (type === "TRUE_FALSE") {
      setQuestionForm({
        ...questionForm,
        type,
        options: [
          { text: "True", isCorrect: false },
          { text: "False", isCorrect: false },
        ],
      })
    } else {
      setQuestionForm({
        ...questionForm,
        type,
        options: questionForm.options.length < 2 
          ? defaultQuestionForm.options 
          : questionForm.options,
      })
    }
  }

  function handleOptionChange(index: number, field: "text" | "isCorrect", value: string | boolean) {
    const newOptions = [...questionForm.options]
    if (field === "isCorrect" && value === true) {
      // For MCQ, only one correct answer
      newOptions.forEach((opt, i) => {
        opt.isCorrect = i === index
      })
    } else {
      newOptions[index] = { ...newOptions[index], [field]: value }
    }
    setQuestionForm({ ...questionForm, options: newOptions })
  }

  function addOption() {
    if (questionForm.options.length < 6) {
      setQuestionForm({
        ...questionForm,
        options: [...questionForm.options, { text: "", isCorrect: false }],
      })
    }
  }

  function removeOption(index: number) {
    if (questionForm.options.length > 2) {
      const newOptions = questionForm.options.filter((_, i) => i !== index)
      setQuestionForm({ ...questionForm, options: newOptions })
    }
  }

  async function handleSubmitQuestion() {
    // Validation
    if (!questionForm.text.trim()) {
      toast.error("Please enter a question")
      return
    }

    const hasCorrectAnswer = questionForm.options.some(o => o.isCorrect)
    if (!hasCorrectAnswer) {
      toast.error("Please select a correct answer")
      return
    }

    const hasEmptyOptions = questionForm.options.some(o => !o.text.trim())
    if (hasEmptyOptions) {
      toast.error("Please fill in all options")
      return
    }

    setIsSubmittingQuestion(true)

    try {
      const url = editingQuestion
        ? `/api/admin/quizzes/${quiz.id}/questions/${editingQuestion.id}`
        : `/api/admin/quizzes/${quiz.id}/questions`

      const response = await fetch(url, {
        method: editingQuestion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionForm),
      })

      if (!response.ok) throw new Error("Failed to save question")

      toast.success(editingQuestion ? "Question updated" : "Question added")
      setQuestionDialogOpen(false)
      
      // Refresh the page to get updated questions
      router.refresh()
      
      // Fetch updated quiz data
      const quizResponse = await fetch(`/api/admin/quizzes/${quiz.id}/questions`)
      const questions = await quizResponse.json()
      setQuiz({ ...quiz, questions })
    } catch {
      toast.error("Failed to save question")
    } finally {
      setIsSubmittingQuestion(false)
    }
  }

  async function handleDeleteQuestion() {
    if (!deleteQuestionId) return

    setIsDeletingQuestion(true)

    try {
      const response = await fetch(`/api/admin/quizzes/${quiz.id}/questions/${deleteQuestionId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast.success("Question deleted")
      setQuiz({
        ...quiz,
        questions: quiz.questions.filter(q => q.id !== deleteQuestionId),
      })
    } catch {
      toast.error("Failed to delete question")
    } finally {
      setIsDeletingQuestion(false)
      setDeleteQuestionId(null)
    }
  }

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
            <p className="text-muted-foreground">
              {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={handlePublishToggle}
          disabled={isPublishing}
          variant={quiz.isPublished ? "outline" : "default"}
        >
          {isPublishing && <Loader2 className="mr-2 size-4 animate-spin" />}
          {quiz.isPublished ? "Unpublish" : "Publish Quiz"}
        </Button>
      </div>

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAddQuestion}>
              <Plus className="mr-2 size-4" />
              Add Question
            </Button>
          </div>

          {quiz.questions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Plus className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add questions to your quiz to get started.
                </p>
                <Button onClick={openAddQuestion}>
                  <Plus className="mr-2 size-4" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {quiz.questions.map((question, index) => (
                <Card key={question.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GripVertical className="size-4" />
                        <span className="font-medium">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium mb-2">{question.text}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">
                                {question.type === "MCQ" ? "Multiple Choice" : "True/False"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {question.points} point{question.points !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditQuestion(question)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteQuestionId(question.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-1.5">
                          {question.options.map((option, optIndex) => (
                            <div
                              key={option.id}
                              className={`flex items-center gap-2 text-sm p-2 rounded ${
                                option.isCorrect 
                                  ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" 
                                  : "bg-muted/50"
                              }`}
                            >
                              {option.isCorrect ? (
                                <Check className="size-3.5" />
                              ) : (
                                <X className="size-3.5 text-muted-foreground" />
                              )}
                              <span>{String.fromCharCode(65 + optIndex)}. {option.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Settings</CardTitle>
              <CardDescription>
                Configure your quiz settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
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
                    value={settings.timeLimitMinutes}
                    onChange={(e) => setSettings({ ...settings, timeLimitMinutes: parseInt(e.target.value) || 30 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    min={0}
                    max={100}
                    value={settings.passingScore}
                    onChange={(e) => setSettings({ ...settings, passingScore: parseInt(e.target.value) || 70 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="font-medium">Shuffle Questions</Label>
                  <p className="text-sm text-muted-foreground">
                    Randomize the order of questions for each attempt
                  </p>
                </div>
                <Switch
                  checked={settings.shuffleQuestions}
                  onCheckedChange={(checked) => setSettings({ ...settings, shuffleQuestions: checked })}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  <Save className="mr-2 size-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Edit Question" : "Add Question"}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion 
                ? "Update the question and its options" 
                : "Create a new question for your quiz"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select
                value={questionForm.type}
                onValueChange={(value) => handleQuestionTypeChange(value as QuestionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MCQ">Multiple Choice</SelectItem>
                  <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionText">Question</Label>
              <Textarea
                id="questionText"
                placeholder="Enter your question..."
                value={questionForm.text}
                onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                min={1}
                max={100}
                value={questionForm.points}
                onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 1 })}
                className="w-24"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Answer Options</Label>
                {questionForm.type === "MCQ" && questionForm.options.length < 6 && (
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="mr-1 size-3" />
                    Add Option
                  </Button>
                )}
              </div>
              
              <RadioGroup
                value={questionForm.options.findIndex(o => o.isCorrect).toString()}
                onValueChange={(value) => {
                  const index = parseInt(value)
                  handleOptionChange(index, "isCorrect", true)
                }}
              >
                {questionForm.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <div className="flex-1">
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        value={option.text}
                        onChange={(e) => handleOptionChange(index, "text", e.target.value)}
                        disabled={questionForm.type === "TRUE_FALSE"}
                      />
                    </div>
                    {questionForm.type === "MCQ" && questionForm.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Select the radio button next to the correct answer
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitQuestion} disabled={isSubmittingQuestion}>
              {isSubmittingQuestion && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingQuestion ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Question Confirmation */}
      <AlertDialog open={!!deleteQuestionId} onOpenChange={() => setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingQuestion}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              disabled={isDeletingQuestion}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeletingQuestion && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
