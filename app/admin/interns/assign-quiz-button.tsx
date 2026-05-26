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

/**
 * Convert a datetime-local string (e.g. "2024-01-01T23:10") to a full ISO
 * string in the user's local timezone so the server stores the correct UTC time.
 *
 * datetime-local has NO timezone info — new Date("2024-01-01T23:10") in Node
 * parses as UTC, which is wrong for IST users (they'd be 5h30m off).
 * By appending the local offset we get the correct UTC equivalent.
 */
function localDatetimeToISO(value: string): string {
  if (!value) return ""
  // new Date(value) in the browser interprets datetime-local as LOCAL time
  return new Date(value).toISOString()
}

export function AssignQuizButton({ internId, internName, quizzes }: AssignQuizButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedQuizId, setSelectedQuizId] = useState<string>("")
  const [startAt, setStartAt] = useState<string>("")
  const [endAt, setEndAt] = useState<string>("")
  const [isAssigning, setIsAssigning] = useState(false)

  function reset() {
    setSelectedQuizId("")
    setStartAt("")
    setEndAt("")
  }

  async function handleAssign() {
    if (!selectedQuizId) {
      toast.error("Please select a quiz")
      return
    }

    // Client-side window validation
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      toast.error("Start time must be before end time")
      return
    }

    setIsAssigning(true)

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId:  selectedQuizId,
          internId,
          // Convert local datetime strings to proper ISO UTC strings
          startAt: startAt ? localDatetimeToISO(startAt) : null,
          endAt:   endAt   ? localDatetimeToISO(endAt)   : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign quiz")
      }

      toast.success("Quiz assigned successfully")
      setOpen(false)
      reset()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign quiz")
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
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
            Assign a quiz to {internName}. Set a join window so interns can only
            start between the two times. Leave blank for no restriction.
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startAt">
                Join Window Opens
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">
                Join Window Closes
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          {startAt && endAt && (
            <p className="text-xs text-muted-foreground">
              Interns can join between{" "}
              <strong>{new Date(startAt).toLocaleString()}</strong> and{" "}
              <strong>{new Date(endAt).toLocaleString()}</strong>.
              Once started, they get the full quiz time limit.
            </p>
          )}
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
