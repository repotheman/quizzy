"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { EyeOff, Loader2 } from "lucide-react"

interface UnpublishResultsButtonProps {
  quizId: string
}

export function UnpublishResultsButton({ quizId }: UnpublishResultsButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUnpublish() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/unpublish`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to unpublish")
      toast.success("Results unpublished. Scores and ranks are now hidden from interns.")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unpublish results")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <EyeOff className="mr-2 size-4" />
          Unpublish Results
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unpublish Results?</AlertDialogTitle>
          <AlertDialogDescription>
            This will hide scores and ranks from interns. All rank assignments will be
            cleared. You can re-publish the results later when you are ready.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnpublish} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Unpublish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
