"use client"

import { create } from "zustand"

export interface QuizQuestion {
  id: string
  text: string
  type: "MCQ" | "TRUE_FALSE"
  points: number
  options: {
    id: string
    text: string
  }[]
}

interface ExamState {
  attemptId: string | null
  quizId: string | null
  quizTitle: string
  questions: QuizQuestion[]
  currentQuestionIndex: number
  answers: Record<string, string> // questionId -> optionId
  violations: number
  maxViolations: number
  timeRemaining: number // in seconds
  timeLimitMinutes: number
  startedAt: Date | null
  isSubmitting: boolean
  isTerminated: boolean
  terminationReason: string | null

  // Actions
  initializeExam: (data: {
    attemptId: string
    quizId: string
    quizTitle: string
    questions: QuizQuestion[]
    maxViolations: number
    timeLimitMinutes: number
    existingAnswers?: Record<string, string>
    violations?: number
    startedAt: Date
  }) => void
  setCurrentQuestion: (index: number) => void
  nextQuestion: () => void
  prevQuestion: () => void
  setAnswer: (questionId: string, optionId: string) => void
  addViolation: () => void
  setTimeRemaining: (seconds: number) => void
  setIsSubmitting: (submitting: boolean) => void
  terminate: (reason: string) => void
  reset: () => void
}

const initialState = {
  attemptId: null,
  quizId: null,
  quizTitle: "",
  questions: [],
  currentQuestionIndex: 0,
  answers: {},
  violations: 0,
  maxViolations: 3,
  timeRemaining: 0,
  timeLimitMinutes: 0,
  startedAt: null,
  isSubmitting: false,
  isTerminated: false,
  terminationReason: null,
}

export const useExamStore = create<ExamState>((set, get) => ({
  ...initialState,

  initializeExam: (data) => {
    const elapsedSeconds = Math.floor(
      (Date.now() - new Date(data.startedAt).getTime()) / 1000
    )
    const totalSeconds = data.timeLimitMinutes * 60
    const remaining = Math.max(0, totalSeconds - elapsedSeconds)

    set({
      attemptId: data.attemptId,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      questions: data.questions,
      currentQuestionIndex: 0,
      answers: data.existingAnswers || {},
      violations: data.violations || 0,
      maxViolations: data.maxViolations,
      timeRemaining: remaining,
      timeLimitMinutes: data.timeLimitMinutes,
      startedAt: data.startedAt,
      isSubmitting: false,
      isTerminated: false,
      terminationReason: null,
    })
  },

  setCurrentQuestion: (index) => {
    const { questions } = get()
    if (index >= 0 && index < questions.length) {
      set({ currentQuestionIndex: index })
    }
  },

  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get()
    if (currentQuestionIndex < questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 })
    }
  },

  prevQuestion: () => {
    const { currentQuestionIndex } = get()
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 })
    }
  },

  setAnswer: (questionId, optionId) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: optionId },
    }))
  },

  addViolation: () => {
    set((state) => ({ violations: state.violations + 1 }))
  },

  setTimeRemaining: (seconds) => {
    set({ timeRemaining: Math.max(0, seconds) })
  },

  setIsSubmitting: (submitting) => {
    set({ isSubmitting: submitting })
  },

  terminate: (reason) => {
    set({ isTerminated: true, terminationReason: reason })
  },

  reset: () => {
    set(initialState)
  },
}))
