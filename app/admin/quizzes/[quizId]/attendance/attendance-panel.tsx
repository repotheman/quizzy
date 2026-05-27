"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  AlertTriangle,
  Users,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  computeSummary,
  formatElapsed,
  getWindowStatus,
} from "@/lib/attendance"
import type { AttendanceRecord, AttendanceResponse, WindowStatus } from "@/lib/attendance"

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterValue = "ALL" | "IN_PROGRESS" | "NOT_JOINED" | "COMPLETED"

interface Props {
  quizId: string
  initialData: AttendanceResponse
}

// ─── Window status badge ──────────────────────────────────────────────────────

function WindowStatusBadge({ status }: { status: WindowStatus }) {
  switch (status) {
    case "OPEN":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800">
          OPEN
        </Badge>
      )
    case "UPCOMING":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800">
          UPCOMING
        </Badge>
      )
    case "CLOSED":
      return (
        <Badge variant="secondary">
          CLOSED
        </Badge>
      )
    case "NO_WINDOW_SET":
      return (
        <Badge variant="secondary">
          NO WINDOW SET
        </Badge>
      )
  }
}

// ─── Intern status badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AttendanceRecord["status"] }) {
  switch (status) {
    case "IN_PROGRESS":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800">
          In Progress
        </Badge>
      )
    case "NOT_JOINED":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800">
          Not Joined
        </Badge>
      )
    case "COMPLETED":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800">
          Completed
        </Badge>
      )
  }
}

// ─── Elapsed ticker ───────────────────────────────────────────────────────────

function ElapsedCell({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt))

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(formatElapsed(startedAt))
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <span className="flex items-center gap-1 text-sm font-mono">
      <Clock className="size-3.5 text-muted-foreground" />
      {elapsed}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AttendancePanel({ quizId, initialData }: Props) {
  const [data, setData] = useState<AttendanceResponse>(initialData)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date(initialData.fetchedAt))
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterValue>("ALL")
  const [, setTick] = useState(0) // force re-render for "last updated X seconds ago"

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Re-render every second so "last updated" stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Polling
  useEffect(() => {
    async function fetchData() {
      // Create a new AbortController for this fetch
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        const res = await fetch(`/api/admin/quizzes/${quizId}/attendance`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: AttendanceResponse = await res.json()
        setData(json)
        setLastUpdated(new Date(json.fetchedAt))
        setError(null)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Failed to refresh attendance data. Showing last known data.")
        }
      }
    }

    function startPolling() {
      intervalRef.current = setInterval(fetchData, 10_000)
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchData()
        startPolling()
      } else {
        stopPolling()
        // Abort any in-flight request
        controllerRef.current?.abort()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    startPolling()

    return () => {
      stopPolling()
      controllerRef.current?.abort()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [quizId])

  // Derived state
  const windowStatus = getWindowStatus(data.quiz.startAt, data.quiz.endAt)
  const summary = computeSummary(data.interns)

  const filteredInterns =
    filter === "ALL"
      ? data.interns
      : data.interns.filter((i) => i.status === filter)

  const secondsAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
  const lastUpdatedLabel =
    secondsAgo < 5
      ? "just now"
      : `${secondsAgo}s ago`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/quizzes/${quizId}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{data.quiz.title}</h1>
              <WindowStatusBadge status={windowStatus} />
            </div>
            <p className="text-muted-foreground mt-1">
              {data.quiz.startAt && data.quiz.endAt ? (
                <>
                  {format(new Date(data.quiz.startAt), "MMM d, h:mm a")}
                  {" – "}
                  {format(new Date(data.quiz.endAt), "h:mm a")}
                  {" · "}
                  {data.quiz.timeLimitMinutes} min limit
                </>
              ) : (
                <>No join window set · {data.quiz.timeLimitMinutes} min limit</>
              )}
            </p>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
          </span>
          <span>Live · Updated {lastUpdatedLabel}</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="size-3.5" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <UserCheck className="size-3.5" /> Joined
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.joined}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <UserX className="size-3.5" /> Not Joined
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{summary.notJoined}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Activity className="size-3.5" /> In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{summary.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Join Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.joinRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { value: "ALL", label: `All (${summary.total})` },
            { value: "IN_PROGRESS", label: `In Progress (${summary.inProgress})` },
            { value: "NOT_JOINED", label: `Not Joined (${summary.notJoined})` },
            { value: "COMPLETED", label: `Completed (${summary.completed})` },
          ] as { value: FilterValue; label: string }[]
        ).map(({ value, label }) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Attendance table */}
      <Card>
        <CardContent className="p-0">
          {filteredInterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="size-10 mb-3" />
              <p className="text-sm">No interns match this filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined At</TableHead>
                  <TableHead>Elapsed</TableHead>
                  <TableHead>Violations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterns.map((intern) => {
                  const isAbsent =
                    intern.status === "NOT_JOINED" && windowStatus === "CLOSED"

                  return (
                    <TableRow
                      key={intern.internId}
                      className={isAbsent ? "opacity-50" : undefined}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {intern.internName}
                          {isAbsent && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Absent
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {intern.internEmail}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={intern.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {intern.joinedAt
                          ? format(new Date(intern.joinedAt), "h:mm:ss a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {intern.status === "IN_PROGRESS" && intern.startedAt ? (
                          <ElapsedCell startedAt={intern.startedAt} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {intern.violations > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            {intern.violations}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
