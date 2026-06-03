"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Option {
  id: string
  text: string
}

interface QuestionCardProps {
  questionNumber: number
  totalQuestions: number
  text: string
  type: "MCQ" | "TRUE_FALSE"
  points: number
  options: Option[]
  selectedOptionId: string | null
  onSelectOption: (optionId: string) => void
}

/**
 * Renders question text with support for:
 * - Fenced code blocks: ```lang\n...\n```
 * - Inline code: `code`
 * - Plain text paragraphs (newlines preserved)
 */
function QuestionText({ text }: { text: string }) {
  // Split on fenced code blocks first
  const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fenceRegex.exec(text)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      parts.push(
        <InlineText key={lastIndex} text={text.slice(lastIndex, match.index)} />
      )
    }

    const lang = match[1] || ""
    const code = match[2].replace(/\n$/, "") // trim trailing newline

    parts.push(
      <div key={match.index} className="my-4 rounded-lg overflow-hidden border border-border">
        {lang && (
          <div className="px-4 py-1.5 bg-muted text-xs text-muted-foreground font-mono border-b border-border">
            {lang}
          </div>
        )}
        <pre className="p-4 overflow-x-auto bg-[#1e1e1e] text-[#d4d4d4]">
          <code className="text-sm font-mono leading-relaxed whitespace-pre">{code}</code>
        </pre>
      </div>
    )

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    parts.push(<InlineText key={lastIndex} text={text.slice(lastIndex)} />)
  }

  return <div className="mb-6">{parts}</div>
}

/** Renders plain text with inline code support and newline preservation */
function InlineText({ text }: { text: string }) {
  if (!text.trim()) return null

  // Split on inline code backticks
  const inlineRegex = /`([^`]+)`/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null

  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<PlainText key={last} text={text.slice(last, m.index)} />)
    }
    nodes.push(
      <code
        key={m.index}
        className="px-1.5 py-0.5 rounded bg-muted text-[0.85em] font-mono text-foreground"
      >
        {m[1]}
      </code>
    )
    last = m.index + m[0].length
  }

  if (last < text.length) {
    nodes.push(<PlainText key={last} text={text.slice(last)} />)
  }

  return <span>{nodes}</span>
}

/** Renders plain text preserving newlines */
function PlainText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}

export function QuestionCard({
  questionNumber,
  totalQuestions,
  text,
  type,
  points,
  options,
  selectedOptionId,
  onSelectOption,
}: QuestionCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">
            Question {questionNumber} of {totalQuestions}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {type === "TRUE_FALSE" ? "True / False" : "Multiple Choice"}
            </Badge>
            <Badge variant="outline">{points} {points === 1 ? "mark" : "marks"}</Badge>
          </div>
        </div>

        <div className="text-base font-medium">
          <QuestionText text={text} />
        </div>

        <RadioGroup
          value={selectedOptionId || ""}
          onValueChange={onSelectOption}
          className="space-y-3"
        >
          {options.map((option) => (
            <div key={option.id}>
              <Label
                htmlFor={option.id}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                  "hover:bg-accent",
                  selectedOptionId === option.id && "border-primary bg-accent"
                )}
              >
                <RadioGroupItem value={option.id} id={option.id} />
                <span className="text-sm leading-snug break-words">
                  {option.text}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
