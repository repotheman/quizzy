"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Sparkles,
  Copy,
  Check,
  Upload,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react"

interface AiFeedbackPanelProps {
  attemptId: string
  hasFeedback: boolean
}

export function AiFeedbackPanel({ attemptId, hasFeedback }: AiFeedbackPanelProps) {
  const router = useRouter()

  // Step 1: export state
  const [prompt, setPrompt]       = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // Step 2: import state
  const [feedbackJson, setFeedbackJson] = useState("")
  const [jsonError, setJsonError]       = useState<string | null>(null)
  const [loadingSave, setLoadingSave]   = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)

  // ── Step 1: Generate prompt ────────────────────────────────────────────────
  async function handleGeneratePrompt() {
    setLoadingExport(true)
    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/feedback`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate prompt")
      setPrompt(data.prompt)
      setShowExport(true)
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
    toast.success("Prompt copied to clipboard!")
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Step 2: Save feedback ──────────────────────────────────────────────────
  async function handleSaveFeedback() {
    setJsonError(null)

    const raw = feedbackJson.trim()

    // Strip markdown code fences if AI wrapped the response
    const stripped = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    // Replace smart/curly quotes with straight quotes (copy-paste artefact)
    const sanitized = stripped
      .replace(/[\u201C\u201D]/g, '"')  // " "  → "
      .replace(/[\u2018\u2019]/g, "'")  // ' '  → '

    let parsed: unknown
    try {
      parsed = JSON.parse(sanitized)
    } catch (e) {
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}. Try copying directly from the AI's raw output.`)
      return
    }

    setLoadingSave(true)
    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: parsed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save feedback")
      toast.success("AI feedback saved! The intern can now see it.")
      setFeedbackJson("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save feedback")
    } finally {
      setLoadingSave(false)
    }
  }

  // ── Delete feedback ────────────────────────────────────────────────────────
  async function handleDeleteFeedback() {
    setLoadingDelete(true)
    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/feedback`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to remove feedback")
      toast.success("AI feedback removed.")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove feedback")
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <span className="text-sm font-medium">AI Feedback</span>
          {hasFeedback ? (
            <Badge variant="secondary" className="text-xs text-purple-600 dark:text-purple-400 bg-purple-500/10">
              Published
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not generated
            </Badge>
          )}
        </div>
        {hasFeedback && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive text-xs h-7"
            onClick={handleDeleteFeedback}
            disabled={loadingDelete}
          >
            {loadingDelete ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            <span className="ml-1">Remove</span>
          </Button>
        )}
      </div>

      {/* Step 1 */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Step 1 — Generate Prompt</p>
          <span className="text-xs text-muted-foreground">Copy → paste into Claude or ChatGPT</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Generates a structured prompt containing all attempt data ready to paste into any AI.
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePrompt}
            disabled={loadingExport}
          >
            {loadingExport
              ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Generating…</>
              : <><Sparkles className="mr-1.5 size-3.5" /> Generate Prompt</>}
          </Button>

          {prompt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExport(v => !v)}
            >
              {showExport ? <ChevronUp className="mr-1 size-3.5" /> : <ChevronDown className="mr-1 size-3.5" />}
              {showExport ? "Hide" : "Show"} Prompt
            </Button>
          )}
        </div>

        {prompt && showExport && (
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                readOnly
                value={prompt}
                className="font-mono text-[11px] h-40 resize-none bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleCopy} className="h-8">
                {copied
                  ? <><Check className="mr-1.5 size-3.5 text-green-400" /> Copied!</>
                  : <><Copy className="mr-1.5 size-3.5" /> Copy Prompt</>}
              </Button>
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
              >
                Open Claude <ExternalLink className="size-3" />
              </a>
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
              >
                Open ChatGPT <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Step 2 — Paste AI Response</p>
          <span className="text-xs text-muted-foreground">Paste the JSON the AI gives back</span>
        </div>
        <p className="text-xs text-muted-foreground">
          After the AI responds with JSON, paste it here to save and show to the intern.
        </p>
        <Textarea
          value={feedbackJson}
          onChange={(e) => { setFeedbackJson(e.target.value); setJsonError(null) }}
          placeholder={'{\n  "overall_summary": "...",\n  "performance_level": "Good",\n  ...\n}'}
          className="font-mono text-xs h-36 resize-none"
        />
        {jsonError && (
          <p className="text-xs text-destructive">{jsonError}</p>
        )}
        <Button
          size="sm"
          onClick={handleSaveFeedback}
          disabled={!feedbackJson.trim() || loadingSave}
          className="h-8"
        >
          {loadingSave
            ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving…</>
            : <><Upload className="mr-1.5 size-3.5" /> Save Feedback</>}
        </Button>
      </div>
    </div>
  )
}
