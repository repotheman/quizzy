"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ClipboardList, Loader2 } from "lucide-react"

interface Quiz {
  id: string
  title: string
}

interface AssignQuizButtonProps {
  internId: string
  internName: string
  quizzes: Quiz[]
}

export function AssignQuizButton({ internId, internName, quizzes }: AssignQuizButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedQuizId, setSelectedQuizId] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>("")
  const [isAssigning, setIsAssigning] = useState(false)

  async function handleAssign() {
    if (!selectedQuizId) {
      toast.error("Please select a quiz")
      return
    }

    setIsAssigning(true)

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: selectedQuizId,
          internId,
          dueDate: dueDate || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign quiz")
      }

      toast.success("Quiz assigned successfully")
      setOpen(false)
      setSelectedQuizId("")
      setDueDate("")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign quiz")
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList className="mr-2 size-4" />
          Assign Quiz
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Quiz</DialogTitle>
          <DialogDescription>
            Assign a quiz to {internName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Quiz</Label>
            <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a quiz" />
              </SelectTrigger>
              <SelectContent>
                {quizzes.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No published quizzes available
                  </SelectItem>
                ) : (
                  quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || !selectedQuizId}>
            {isAssigning && <Loader2 className="mr-2 size-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
