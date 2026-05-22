import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const sql = neon(process.env.DATABASE_URL)

// Helper to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID()
}

// Types matching our database schema
export type Role = 'ADMIN' | 'INTERN'
export type QuestionType = 'MCQ' | 'TRUE_FALSE'
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TIMED_OUT' | 'TERMINATED'
export type ViolationType = 
  | 'TAB_SWITCH' 
  | 'FULLSCREEN_EXIT' 
  | 'COPY_ATTEMPT' 
  | 'PASTE_ATTEMPT' 
  | 'RIGHT_CLICK' 
  | 'DEVTOOLS_OPEN' 
  | 'WINDOW_BLUR' 
  | 'CONTEXT_MENU'

export interface User {
  id: string
  email: string
  password: string
  name: string
  role: Role
  createdAt: Date
  updatedAt: Date
}

export interface Quiz {
  id: string
  title: string
  description: string | null
  timeLimitMinutes: number
  passingScore: number
  shuffleQuestions: boolean
  maxViolations: number
  isPublished: boolean
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface Question {
  id: string
  quizId: string
  type: QuestionType
  text: string
  points: number
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface Option {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  order: number
}

export interface QuizAssignment {
  id: string
  quizId: string
  internId: string
  assignedById: string
  dueDate: Date | null
  assignedAt: Date
}

export interface QuizAttempt {
  id: string
  quizId: string
  internId: string
  status: AttemptStatus
  score: number | null
  totalPoints: number | null
  percentage: number | null
  passed: boolean | null
  violations: number
  autoSubmitted: boolean
  startedAt: Date
  submittedAt: Date | null
  timeSpentSeconds: number | null
}

export interface Answer {
  id: string
  attemptId: string
  questionId: string
  selectedOptionId: string | null
  isCorrect: boolean | null
  answeredAt: Date
}

export interface Violation {
  id: string
  attemptId: string
  type: ViolationType
  description: string | null
  timestamp: Date
}
