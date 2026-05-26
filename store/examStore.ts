"use client"

// ExamShell manages all exam state locally.
// This file is kept as a no-op so any stale imports don't break the build.
// TODO: remove once all references are cleaned up.

import { create } from "zustand"

interface ExamState {
  reset: () => void
}

export const useExamStore = create<ExamState>(() => ({
  reset: () => {},
}))
