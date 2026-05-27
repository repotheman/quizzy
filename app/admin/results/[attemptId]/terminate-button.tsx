"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { OctagonX, Loader2 } from "lucide-react"

interface TerminateAttemptButtonProps {
  attemptId: string
  status: string
}

export function TerminateAttemptButton({ attemptId, status }: TerminateAttemptButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState("")
  const [open, setOpen] = useState(false)

  if (status !== "IN_PROGRESS") {
    return null
  }

  async function handleTerminate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to terminate attempt")
      toast.success("Attempt terminated successfully")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to terminate attempt")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <OctagonX className="mr-2 size-4" />
          Terminate Attempt
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terminate Attempt?</AlertDialogTitle>
          <AlertDialogDescription>
            This will forcibly end the intern&apos;s active exam session and score all answers
            submitted up to this point. The attempt status will be set to{" "}
            <strong>TERMINATED</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="terminate-reason">Reason (optional)</Label>
          <Textarea
            id="terminate-reason"
            placeholder="Optional reason for termination..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleTerminate} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Terminate
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
