"use client"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { formatTime } from "@/hooks/useTimer"

interface TimerBarProps {
  timeRemaining: number
  totalTime: number
}

export function TimerBar({ timeRemaining, totalTime }: TimerBarProps) {
  const progress = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0
  const minutes = timeRemaining / 60
  const getTimerColor = () => {
    if (minutes < 1) return "text-red-500"
    if (minutes < 5) return "text-yellow-500"
    return "text-foreground"
  }

  const getProgressColor = () => {
    if (minutes < 1) return "[&>div]:bg-red-500"
    if (minutes < 5) return "[&>div]:bg-yellow-500"
    return ""
  }

  return (
    <div className="flex items-center gap-2">
      <Progress
        value={progress}
        className={cn("h-1.5 w-16 sm:w-24", getProgressColor())}
      />
      <span
        className={cn(
          "font-mono text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap",
          getTimerColor(),
          minutes < 1 && "animate-pulse"
        )}
      >
        {formatTime(timeRemaining)}
      </span>
    </div>
  )
}
