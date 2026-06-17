"use client"

import { useState, useEffect } from "react"
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
  X,
  Upload
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

  // Bulk Upload State
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkFormat, setBulkFormat] = useState<"json" | "csv">("json")
  const [bulkData, setBulkData] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [bulkErrors, setBulkErrors] = useState<{row: number, message: string}[]>([])

  // Publish-Assign State
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [assignType, setAssignType] = useState<"all" | "specific" | "department">("all")
  const [interns, setInterns] = useState<{ id: string; name: string; email: string; department?: string }[]>([])
  const [selectedInternIds, setSelectedInternIds] = useState<string[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>("")
  const [startAt, setStartAt] = useState<string | null>(null)
  const [endAt, setEndAt] = useState<string | null>(null)

  // Load interns for publish dialog
  useEffect(() => {
    if (publishDialogOpen && (assignType === "specific" || assignType === "department") && interns.length === 0) {
      let mounted = true
      ;(async () => {
        try {
          const res = await fetch(`/api/admin/interns`)
          if (!res.ok) return
          const data = await res.json()
          if (!mounted) return
          setInterns(data)
        } catch (err) {
          console.error("Failed to load interns:", err)
        }
      })()
      return () => { mounted = false }
    }
  }, [publishDialogOpen, assignType, interns.length])


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
      setQuiz({...quiz, ...settings})
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  function handlePublishClick() {
    if (quiz.isPublished) {
      handleUnpublish()
    } else {
      if (quiz.questions.length === 0) {
        toast.error("Cannot publish a quiz with no questions")
        return
      }
      // Reset window state so re-publish starts fresh
      setStartAt(null)
      setEndAt(null)
      setAssignType("all")
      setSelectedInternIds([])
      setPublishDialogOpen(true)
    }
  }

  async function handleUnpublish() {
    setIsPublishing(true)
    try {
      const response = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: false }),
      })

      if (!response.ok) throw new Error("Failed to unpublish")

      setQuiz({ ...quiz, isPublished: false })
      toast.success("Quiz unpublished")
    } catch {
      toast.error("Failed to update publish status")
    } finally {
      setIsPublishing(false)
    }
  }

  async function handlePublishAndAssign() {
    setIsPublishing(true)
    try {
      // 1. Publish quiz
      const pubRes = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      })

      if (!pubRes.ok) throw new Error("Failed to publish quiz")

      // 2. Assign to interns
      // Convert datetime-local strings (no tz info) to proper ISO UTC strings.
      // new Date(value) in the browser treats datetime-local as LOCAL time,
      // so .toISOString() gives the correct UTC equivalent.
      const body: any = {
        quizId:  quiz.id,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt:   endAt   ? new Date(endAt).toISOString()   : null,
      }

      if (assignType === "all") {
        body.assignToAll = true
      } else if (assignType === "department") {
        if (!selectedDepartment) {
          toast.error("Please select a department")
          setIsPublishing(false)
          return
        }
        body.department = selectedDepartment
      } else {
        if (selectedInternIds.length === 0) {
          toast.error("Please select at least one intern")
          setIsPublishing(false)
          return
        }
        body.internIds = selectedInternIds
      }

      const assignRes = await fetch(`/api/admin/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!assignRes.ok) {
        const errData = await assignRes.json()
        throw new Error(errData.error || "Failed to assign quiz")
      }

      setQuiz({ ...quiz, isPublished: true })
      setPublishDialogOpen(false)
      toast.success("Quiz published and assigned successfully!")
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsPublishing(false)
    }
  }

  // --- Bulk Upload Functions ---
  async function handleBulkUpload() {
    if (!bulkData.trim()) {
      toast.error("Please provide data to upload")
      return
    }
    
    setIsUploading(true)
    setBulkErrors([])

    try {
      const response = await fetch(`/api/admin/quizzes/${quiz.id}/questions/bulk-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: bulkFormat, data: bulkData }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.errors && result.errors.length > 0) {
          setBulkErrors(result.errors)
        } else {
          toast.error(result.error || "Failed to import questions")
        }
        return
      }

      if (result.errors && result.errors.length > 0) {
        setBulkErrors(result.errors)
        toast.warning(`Imported ${result.imported} questions, but had some errors.`)
      } else {
        toast.success(`Successfully imported ${result.imported} questions!`)
        setBulkDialogOpen(false)
        setBulkData("")
      }

      // Refresh questions list internally
      const qRes = await fetch(`/api/admin/quizzes/${quiz.id}/questions`)
      if (qRes.ok) {
        const questions = await qRes.json()
        setQuiz(prev => ({ ...prev, questions }))
      }
    } catch (err) {
      console.error(err)
      toast.error("An unexpected error occurred during import")
    } finally {
      setIsUploading(false)
    }
  }

  // --- Question Add/Edit/Delete ---
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
      
      // Refresh questions
      const quizResponse = await fetch(`/api/admin/quizzes/${quiz.id}/questions`)
      if (quizResponse.ok) {
        const questions = await quizResponse.json()
        setQuiz(prev => ({ ...prev, questions }))
      }
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
          onClick={handlePublishClick}
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
              <Upload className="mr-2 size-4" />
              Import Questions
            </Button>
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
                  Add questions to your quiz or import them in bulk to get started.
                </p>
                <div className="flex gap-4">
                   <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                    <Upload className="mr-2 size-4" />
                    Import
                  </Button>
                  <Button onClick={openAddQuestion}>
                    <Plus className="mr-2 size-4" />
                    Add Question
                  </Button>
                </div>
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

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Questions</DialogTitle>
            <DialogDescription>
              Bulk import questions via JSON or CSV format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-4 items-center">
              <Label>Format:</Label>
              <RadioGroup value={bulkFormat} onValueChange={(val) => setBulkFormat(val as "json" | "csv")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="json" id="fmt-json" />
                  <Label htmlFor="fmt-json" className="font-normal">JSON</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <Label htmlFor="fmt-csv" className="font-normal">CSV</Label>
                </div>
              </RadioGroup>
              <div className="ml-auto">
                <Button variant="link" size="sm" asChild>
                  <a href={`/templates/quiz-template.${bulkFormat}`} download>Download Template</a>
                </Button>
              </div>
            </div>

            <Textarea
              className="font-mono text-xs h-64"
              placeholder={`Paste your ${bulkFormat.toUpperCase()} data here...`}
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
            />
            
            <p className="text-xs text-muted-foreground">
              Alternatively, you can open the template file, edit it, and paste its contents here.
            </p>

            {bulkErrors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20 mt-4">
                <h4 className="text-sm font-semibold text-destructive mb-2">Import Errors</h4>
                <ul className="text-xs text-destructive space-y-1 list-disc pl-4 max-h-32 overflow-y-auto">
                  {bulkErrors.map((err, i) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkUpload} disabled={isUploading || !bulkData.trim()}>
              {isUploading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish & Assign Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Publish & Assign Quiz</DialogTitle>
            <DialogDescription>
              Publishing makes this quiz available to interns. If interns are already assigned,
              their join window will be updated with the new times.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Who should take this quiz?</Label>
              <RadioGroup value={assignType} onValueChange={(val) => setAssignType(val as "all" | "specific" | "department")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="assign-all" />
                  <Label htmlFor="assign-all">All Interns</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="department" id="assign-department" />
                  <Label htmlFor="assign-department">By Department</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="assign-specific" />
                  <Label htmlFor="assign-specific">Specific Interns</Label>
                </div>
              </RadioGroup>
            </div>

            {assignType === "department" && (
              <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                <Label>Select Department</Label>
                <Select
                  value={selectedDepartment}
                  onValueChange={setSelectedDepartment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(interns.map(i => i.department).filter(Boolean))).sort().map(dept => (
                      <SelectItem key={dept} value={dept as string}>{dept as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {assignType === "specific" && (
              <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                <Label>Select Interns</Label>
                <Select
                  value={selectedInternIds.length > 0 ? "selected" : ""}
                  onValueChange={(val) => {
                    if (!selectedInternIds.includes(val)) {
                      setSelectedInternIds([...selectedInternIds, val])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add intern..." />
                  </SelectTrigger>
                  <SelectContent>
                    {interns.filter(i => !selectedInternIds.includes(i.id)).map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedInternIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedInternIds.map(id => {
                      const intern = interns.find(i => i.id === id)
                      if (!intern) return null
                      return (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1">
                          {intern.name}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-background"
                            onClick={() => setSelectedInternIds(selectedInternIds.filter(x => x !== id))}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt">Join Window Opens (Optional)</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={startAt || ""}
                  onChange={(e) => setStartAt(e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt">Join Window Closes (Optional)</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={endAt || ""}
                  onChange={(e) => setEndAt(e.target.value || null)}
                />
              </div>
            </div>

            {(startAt || endAt) && (
              <p className="text-xs text-muted-foreground rounded-md border px-3 py-2">
                Interns can join
                {startAt ? <> from <strong>{new Date(startAt).toLocaleString()}</strong></> : null}
                {endAt   ? <> until <strong>{new Date(endAt).toLocaleString()}</strong></> : null}.
                {" "}Once started, they get the full quiz time limit.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePublishAndAssign} disabled={isPublishing}>
              {isPublishing && <Loader2 className="mr-2 size-4 animate-spin" />}
              Publish & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
