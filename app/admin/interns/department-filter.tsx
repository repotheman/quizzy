"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DepartmentFilter({ departments }: { departments: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentDept = searchParams.get("department") || "all"

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams)
    if (value === "all") {
      params.delete("department")
    } else {
      params.set("department", value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Department:</span>
      <Select value={currentDept} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept} value={dept}>
              {dept}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
