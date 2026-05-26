"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// ─── Colour palette for interns ───────────────────────────────────────────────
const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1",
  "#14b8a6", "#a855f7", "#fb923c", "#22c55e", "#e11d48",
]

// ─── Intern Performance Bar Chart ────────────────────────────────────────────

interface BarData {
  name: string
  fullName: string
  score: number
  best: number
}

export function InternPerformanceChart({ data }: { data: BarData[] }) {
  return (
    <ChartContainer
      config={{ score: { label: "Avg Score", color: "#3b82f6" } }}
      className="h-64 w-full"
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, props) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{props.payload.fullName}</span>
                  <span>Avg: <strong>{value}%</strong></span>
                  <span>Best: <strong>{props.payload.best}%</strong></span>
                </div>
              )}
              hideLabel
            />
          }
        />
        <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ChartContainer>
  )
}

// ─── Trendline Area Chart ─────────────────────────────────────────────────────

interface TrendData {
  quiz: string
  avg: number
  min: number
  max: number
}

export function TrendlineChart({ data }: { data: TrendData[] }) {
  // Shorten quiz names for x-axis
  const display = data.map((d, i) => ({
    ...d,
    label: d.quiz.length > 14 ? d.quiz.slice(0, 13) + "…" : d.quiz,
  }))

  return (
    <ChartContainer
      config={{
        avg: { label: "Avg", color: "#10b981" },
        min: { label: "Min", color: "#10b981" },
        max: { label: "Max", color: "#10b981" },
      }}
      className="h-64 w-full"
    >
      <AreaChart data={display} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const d = payload[0]?.payload as TrendData & { label: string }
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl space-y-1">
                <p className="font-medium">{d.quiz}</p>
                <p>Avg: <strong>{d.avg}%</strong></p>
                <p className="text-muted-foreground">Range: {d.min}% – {d.max}%</p>
              </div>
            )
          }}
        />
        {/* Shaded min–max band */}
        <Area
          type="monotone"
          dataKey="max"
          stroke="transparent"
          fill="url(#rangeGrad)"
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="min"
          stroke="transparent"
          fill="white"
          fillOpacity={1}
          legendType="none"
        />
        {/* Avg line */}
        <Line
          type="monotone"
          dataKey="avg"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ─── Intern Progress Multi-line Chart ────────────────────────────────────────

interface ProgressData {
  quiz: string
  [internName: string]: string | number
}

export function InternProgressChart({
  data,
  interns,
}: {
  data: ProgressData[]
  interns: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(interns))

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function selectAll() { setSelected(new Set(interns)) }
  function clearAll()  { setSelected(new Set()) }

  // Shorten quiz labels
  const display = data.map(d => ({
    ...d,
    label: (d.quiz as string).length > 14 ? (d.quiz as string).slice(0, 13) + "…" : d.quiz,
  }))

  return (
    <div className="space-y-4">
      {/* Intern selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Choose interns to display</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll}>Select all</Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAll}>Clear</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
          {interns.map((name, idx) => (
            <div key={name} className="flex items-center gap-2">
              <Checkbox
                id={`intern-${name}`}
                checked={selected.has(name)}
                onCheckedChange={() => toggle(name)}
                style={{ borderColor: COLORS[idx % COLORS.length], backgroundColor: selected.has(name) ? COLORS[idx % COLORS.length] : undefined }}
              />
              <Label htmlFor={`intern-${name}`} className="text-xs font-normal cursor-pointer truncate">
                {name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={display} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl space-y-1 min-w-[120px]">
                    <p className="font-medium mb-1">{payload[0]?.payload?.quiz ?? label}</p>
                    {payload.map(p => (
                      <div key={p.dataKey} className="flex justify-between gap-4">
                        <span style={{ color: p.color }}>{p.name}</span>
                        <span className="font-mono font-medium">{p.value}%</span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
            {interns.map((name, idx) =>
              selected.has(name) ? (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: COLORS[idx % COLORS.length] }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
