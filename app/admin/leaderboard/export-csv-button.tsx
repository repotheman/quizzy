"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Download, Loader2 } from "lucide-react"

interface ExportCsvButtonProps {
  quizId: string
}

export function ExportCsvButton({ quizId }: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/export`)
      if (!res.ok) throw new Error("Failed to export results")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      // Get filename from Content-Disposition header if available
      const disposition = res.headers.get("Content-Disposition")
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `results-${quizId}.csv`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export results")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Download className="mr-2 size-4" />
      )}
      Export CSV
    </Button>
  )
}
