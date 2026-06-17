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
import { Users, Loader2 } from "lucide-react"

interface Quiz {
  id: string
  title: string
}

function localDatetimeToISO(value: string): string {
  if (!value) return ""
  return new Date(value).toISOString()
}

export function BulkAssignQuizButton({ quizzes, departments }: { quizzes: Quiz[], departments: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedQuizId, setSelectedQuizId] = useState<string>("")
  const [selectedDept, setSelectedDept] = useState<string>("all")
  const [startAt, setStartAt] = useState<string>("")
  const [endAt, setEndAt] = useState<string>("")
  const [isAssigning, setIsAssigning] = useState(false)

  function reset() {
    setSelectedQuizId("")
    setSelectedDept("all")
    setStartAt("")
    setEndAt("")
  }

  async function handleAssign() {
    if (!selectedQuizId) {
      toast.error("Please select a quiz")
      return
    }

    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      toast.error("Start time must be before end time")
      return
    }

    setIsAssigning(true)

    try {
      const body: any = {
        quizId: selectedQuizId,
        startAt: startAt ? localDatetimeToISO(startAt) : null,
        endAt: endAt ? localDatetimeToISO(endAt) : null,
      }

      if (selectedDept === "all") {
        body.assignToAll = true
      } else {
        body.department = selectedDept
      }

      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to bulk assign quiz")
      }

      toast.success(data.message || "Quiz assigned successfully")
      setOpen(false)
      reset()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bulk assign quiz")
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Users className="size-4" />
          Bulk Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Assign Quiz</DialogTitle>
          <DialogDescription>
            Assign a quiz to all interns or a specific department at once.
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
            <Label>Target Group</Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger>
                <SelectValue placeholder="Select target group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interns</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    Department: {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bulkStartAt">
                Join Window Opens
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="bulkStartAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulkEndAt">
                Join Window Closes
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="bulkEndAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || !selectedQuizId}>
            {isAssigning && <Loader2 className="mr-2 size-4 animate-spin" />}
            Bulk Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
