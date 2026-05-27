"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface ScoreDataPoint {
  name: string
  quizTitle: string
  score: number
  passing: number
  passed: boolean
  date: string
}

interface InternScoreChartProps {
  data: ScoreDataPoint[]
}

const chartConfig = {
  score: {
    label: "Your Score",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function InternScoreChart({ data }: InternScoreChartProps) {
  // Use the passing score from the first data point as a reference line
  // (most quizzes share the same passing score; if they differ we show the first)
  const passingScore = data[0]?.passing ?? 70

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />

        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
          tickMargin={8}
        />

        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
          tickMargin={8}
          tickFormatter={(v) => `${v}%`}
          width={40}
        />

        {/* Passing threshold reference line */}
        <ReferenceLine
          y={passingScore}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          label={{
            value: `Pass ${passingScore}%`,
            position: "insideTopRight",
            fontSize: 11,
            fill: "hsl(var(--muted-foreground))",
          }}
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload as ScoreDataPoint | undefined
                return d ? `${d.quizTitle} · ${d.date}` : ""
              }}
              formatter={(value) => [`${value}%`, "Score"]}
            />
          }
        />

        <Area
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fill="url(#scoreGradient)"
          dot={(props) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScoreDataPoint }
            return (
              <circle
                key={`dot-${payload.name}`}
                cx={cx}
                cy={cy}
                r={5}
                fill={payload.passed ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            )
          }}
          activeDot={{ r: 7, strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
