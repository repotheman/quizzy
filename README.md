# InternIQ — Proctored Quiz Platform

A full-stack exam platform built for managing intern assessments. Admins create and assign quizzes, interns take them under proctored conditions, and results are published as a leaderboard once everyone is done.

---

## What We've Built

### Core Architecture
- **Next.js 16** (App Router) + **TypeScript**
- **Neon** (serverless PostgreSQL) via `@neondatabase/serverless` — all time comparisons run server-side using `NOW()` to avoid clock skew
- **Prisma 7** for schema management and migrations
- **NextAuth v5** with JWT + Credentials provider
- **Tailwind CSS v4** + shadcn/ui component library

### Authentication & Roles
- Two roles: `ADMIN` and `INTERN`
- Middleware-level route protection — `/admin/*` requires ADMIN, `/intern/*` requires INTERN
- Secure password hashing with bcrypt

### Quiz Management (Admin)
- Create, edit, publish, and delete quizzes
- Add MCQ and True/False questions with per-question point values
- Bulk upload questions via CSV or JSON
- Configure time limit, passing score, max violations, and question/option shuffle flags

### Assignment System
- Assign quizzes to individual interns, a list, by email, or all interns at once
- Set a **join window** (`startAt` → `endAt`) — interns can only start the exam within this window
- Once an intern starts, they get the **full time limit** from that moment (not cut off by `endAt`)
- `joinedAt` timestamp recorded on assignment for attendance tracking
- Quiz must be published before it can be assigned

### Exam Experience (Intern)
- Fullscreen enforcement with overlay prompt on exit
- Per-question answer saving (upsert on every selection)
- Timer anchored to `attempt.startedAt` server-side — immune to client clock manipulation
- Question and option shuffle support (per quiz config)
- One attempt per intern per quiz, enforced at DB level

### Proctoring
- Violations tracked: tab switch, fullscreen exit, copy/paste, right-click, devtools open, window blur, context menu
- 1.5s debounce per violation type to avoid spam
- 1.5s grace period on mount to avoid false positives
- **Auto-terminate** when violations reach `maxViolations` — handled server-side, not just client-side
- All violations logged to `violations` table with type and timestamp

### Scoring & Finalization
- Answers scored in bulk at finalization via a single SQL UPDATE (not per-answer at save time)
- Attempt status: `IN_PROGRESS` → `SUBMITTED` / `TIMED_OUT` / `TERMINATED`
- Score, percentage, pass/fail stored on the attempt record

### Result Publishing
- Results are **hidden from interns** until published
- **Auto-publish**: triggers automatically when every assigned intern has a finalized attempt
- **Manual publish**: admin can publish at any time via one click
- On publish, **rank** is computed for each attempt (ordered by `percentage DESC`, `timeSpentSeconds ASC` as tiebreaker) and stored on the attempt

### Intern Dashboard
- Stats: assigned, completed, passed, average score
- Pending quizzes with join window info
- History table: status, score, rank, time spent, violations — all hidden until results are published

---

## Schema Overview

```
User ──< QuizAssignment >── Quiz ──< Question ──< Option
                │                        │
                │                        └──< Answer
                │
         QuizAttempt ──< Answer
                    ──< Violation
```

Key design decisions:
- `QuizAssignment.joinedAt` — attendance marker, set when intern creates their attempt
- `QuizAssignment.startAt / endAt` — join window only, not a submission deadline
- `QuizAttempt.rank` — computed and stored at publish time, not recalculated on every request
- `Answer.isCorrect` — always `NULL` during the exam, set in bulk at finalization
- `@@unique([internId, quizId])` on `QuizAttempt` — one attempt per intern per quiz at DB level

---

## What's Next

### Leaderboard & Analytics
- [ ] Admin leaderboard page per quiz — ranked table with score, time, violations, pass/fail
- [ ] Admin analytics dashboard — overall intern performance, quiz difficulty stats, pass rate trends
- [ ] Intern personal dashboard — rank history across all quizzes, performance over time, strengths/weaknesses by topic

### Attendance View
- [ ] Admin attendance panel per quiz — who has joined (`joinedAt` set), who hasn't, who is still in progress
- [ ] Real-time or polling-based view so admin can monitor during the exam window

### Result Pages
- [ ] Intern result detail page — see which questions were right/wrong after results are published
- [ ] Admin result detail page — per-intern answer breakdown, violation log timeline

### Quiz Improvements
- [ ] Question bank — reuse questions across multiple quizzes
- [ ] Question categories/tags for topic-based analytics
- [ ] Rich text / image support in question text and options
- [ ] Preview mode for admins before publishing

### Assignment Improvements
- [ ] Edit existing assignment windows (reschedule)
- [ ] Notify interns via email when assigned a quiz
- [ ] Bulk re-assign or remove assignments

### Admin Controls
- [ ] Manually terminate an in-progress attempt
- [ ] Override/adjust a score after the fact
- [ ] Unpublish results (revert to hidden)
- [ ] Export results as CSV

### Infrastructure
- [ ] Remove stub `store/examStore.ts` once confirmed no references remain
- [ ] Add rate limiting on attempt/answer/violation API routes
- [ ] Add proper error boundaries on exam page
- [ ] E2E tests for the critical exam flow (start → answer → submit → publish)

---

## Getting Started

```bash
pnpm install
pnpm dev
```

Set up your `.env.local`:

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=your-secret-here
```

Run migrations:

```bash
npx prisma migrate deploy
```

Open [http://localhost:3000](http://localhost:3000).
