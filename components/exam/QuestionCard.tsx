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
          <Badge variant="outline">{points} {points === 1 ? "mark" : "marks"}</Badge>
        </div>

        <p className="text-lg font-medium mb-6">{text}</p>

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
                <span className="text-sm">{option.text}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
