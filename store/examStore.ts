"use client"

// ExamShell manages its own local state now.
// This store is kept as a thin stub so any remaining imports don't break.
// It can be removed entirely once all references are cleaned up.

import { create } from "zustand"

interface ExamState {
  reset: () => void
}

export const useExamStore = create<ExamState>(() => ({
  reset: () => {},
}))
