import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Use neon with no static fetchOptions.
// A static AbortSignal (like AbortSignal.timeout(60_000)) is created once at
// module load time — once it fires or is aborted it stays aborted permanently,
// causing every subsequent query to fail immediately.
// Neon's HTTP driver has no built-in timeout limit; the serverless platform
// (Vercel, etc.) enforces its own function-level timeout (typically 60s),
// which is sufficient to handle Neon free-tier cold starts (~2–30s).
export const sql = neon(process.env.DATABASE_URL)

export function generateId(): string {
  return crypto.randomUUID()
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role          = 'ADMIN' | 'INTERN'
export type QuestionType  = 'MCQ' | 'TRUE_FALSE'
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

// ─── Model types ──────────────────────────────────────────────────────────────

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
  passingScore: number        // percentage 0–100
  shuffleQuestions: boolean
  shuffleOptions: boolean
  maxViolations: number
  isPublished: boolean
  resultsPublishedAt: Date | null  // null = results hidden from interns
  resultsPublishedBy: string | null // null = auto-published
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
  startAt: Date | null   // join window opens  (null = no restriction)
  endAt: Date | null     // join window closes (null = no restriction)
  joinedAt: Date | null  // attendance — set when intern starts their attempt
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
  rank: number | null          // set when results are published
  violations: number
  autoSubmitted: boolean
  startedAt: Date
  submittedAt: Date | null
  timeSpentSeconds: number | null
  scoreOverriddenAt: Date | null  // non-null when score was manually adjusted by an admin
  scoreOverriddenBy: string | null // adminId of the user who applied the override
}

export interface Answer {
  id: string
  attemptId: string
  questionId: string
  selectedOptionId: string | null
  isCorrect: boolean | null  // null until finalization
  answeredAt: Date
  updatedAt: Date
}

export interface Violation {
  id: string
  attemptId: string
  type: ViolationType
  timestamp: Date
}

export interface AdminAuditLog {
  id: string
  adminId: string
  action: string   // 'ADMIN_TERMINATED' | 'SCORE_OVERRIDE' | 'RESULTS_UNPUBLISHED'
  targetType: string  // 'attempt' | 'quiz'
  targetId: string
  metadata: Record<string, unknown>
  createdAt: Date
}
