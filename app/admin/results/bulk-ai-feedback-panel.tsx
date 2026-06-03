"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Sparkles, Copy, Check, Upload, Loader2, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react"

interface BulkAiFeedbackPanelProps {
  quizId: string
  studentCount: number
}

export function BulkAiFeedbackPanel({ quizId, studentCount }: BulkAiFeedbackPanelProps) {
  const router = useRouter()

  const [prompt, setPrompt]             = useState<string | null>(null)
  const [showPrompt, setShowPrompt]     = useState(false)
  const [copied, setCopied]             = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)

  const [feedbackJson, setFeedbackJson] = useState("")
  const [jsonError, setJsonError]       = useState<string | null>(null)
  const [loadingSave, setLoadingSave]   = useState(false)
  const [saveResult, setSaveResult]     = useState<{ saved: number; total: number } | null>(null)

  async function handleGenerate() {
    setLoadingExport(true)
    setPrompt(null)
    try {
      const res  = await fetch(`/api/admin/quizzes/${quizId}/bulk-feedback`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate prompt")
      setPrompt(data.prompt)
      setShowPrompt(true)
      toast.success(`Prompt generated for ${data.studentCount} student${data.studentCount !== 1 ? "s" : ""}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate prompt")
    } finally {
      setLoadingExport(false)
    }
  }

  async function handleCopy() {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast.success("Prompt copied — paste it into Claude or ChatGPT")
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleSave() {
    setJsonError(null)
    setSaveResult(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(feedbackJson.trim())
    } catch {
      setJsonError("Invalid JSON — make sure you pasted the AI's response exactly.")
      return
    }

    if (!Array.isArray(parsed)) {
      setJsonError("Expected a JSON array [ {...}, {...} ] — the AI should return an array.")
      return
    }

    setLoadingSave(true)
    try {
      const res  = await fetch(`/api/admin/quizzes/${quizId}/bulk-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: parsed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save feedback")

      setSaveResult({ saved: data.saved, total: data.total })
      toast.success(`Saved feedback for ${data.saved} / ${data.total} students`)
      setFeedbackJson("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save feedback")
    } finally {
      setLoadingSave(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="size-5 text-purple-500 shrink-0" />
        <div>
          <p className="font-medium text-sm">Bulk AI Feedback</p>
          <p className="text-xs text-muted-foreground">
            Generate one prompt for all {studentCount} student{studentCount !== 1 ? "s" : ""}, paste into Claude or ChatGPT, then save the response to show each intern their personalised feedback.
          </p>
        </div>
      </div>

      {/* Step 1 */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Step 1 — Generate Prompt</p>
          <span className="text-xs text-muted-foreground">All {studentCount} students in one prompt</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loadingExport}>
            {loadingExport
              ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Generating…</>
              : <><Sparkles className="mr-1.5 size-3.5" /> Generate Bulk Prompt</>}
          </Button>

          {prompt && (
            <Button variant="outline" size="sm" onClick={() => setShowPrompt(v => !v)}>
              {showPrompt ? <><ChevronUp className="mr-1 size-3.5" /> Hide</> : <><ChevronDown className="mr-1 size-3.5" /> Show</>} Prompt
            </Button>
          )}
        </div>

        {prompt && showPrompt && (
          <div className="space-y-2">
            <Textarea
              readOnly
              value={prompt}
              className="font-mono text-[11px] h-44 resize-none bg-background"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <Button size="sm" onClick={handleCopy} className="h-8">
                {copied
                  ? <><Check className="mr-1.5 size-3.5 text-green-400" /> Copied!</>
                  : <><Copy className="mr-1.5 size-3.5" /> Copy Prompt</>}
              </Button>
              <a href="https://claude.ai" target="_blank" rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2">
                Claude <ExternalLink className="size-3" />
              </a>
              <a href="https://chatgpt.com" target="_blank" rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2">
                ChatGPT <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Step 2 — Paste AI Response</p>
          <span className="text-xs text-muted-foreground">Paste the JSON array the AI returns</span>
        </div>
        <p className="text-xs text-muted-foreground">
          The AI returns a JSON array with one feedback object per student. Paste the entire array here.
        </p>
        <Textarea
          value={feedbackJson}
          onChange={(e) => { setFeedbackJson(e.target.value); setJsonError(null); setSaveResult(null) }}
          placeholder={'[\n  { "attempt_id": "...", "overall_summary": "...", ... },\n  { "attempt_id": "...", ... }\n]'}
          className="font-mono text-xs h-36 resize-none"
        />
        {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        {saveResult && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs text-green-600 dark:text-green-400">
              ✓ Saved {saveResult.saved} / {saveResult.total} feedbacks
            </Badge>
          </div>
        )}
        <Button size="sm" onClick={handleSave} disabled={!feedbackJson.trim() || loadingSave} className="h-8">
          {loadingSave
            ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving…</>
            : <><Upload className="mr-1.5 size-3.5" /> Save All Feedback</>}
        </Button>
      </div>
    </div>
  )
}
