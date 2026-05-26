-- ============================================================
-- Migration: redesign_schema
-- Changes from previous schema:
--   quizzes        : add shuffleOptions, resultsPublishedAt, resultsPublishedBy
--   quiz_assignments: drop dueDate, add joinedAt
--   quiz_attempts  : add rank, drop unique(internId,quizId,status) → unique(internId,quizId)
--   questions      : add unique(quizId, order)
--   options        : add unique(questionId, order)
--   answers        : add questionId FK, add updatedAt
--   violations     : drop description column
-- ============================================================

-- ── quizzes ──────────────────────────────────────────────────────────────────

ALTER TABLE "quizzes"
  ADD COLUMN "shuffleOptions"       BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "resultsPublishedAt"   TIMESTAMP(3),
  ADD COLUMN "resultsPublishedBy"   TEXT;

-- FK: resultsPublishedBy → users.id
ALTER TABLE "quizzes"
  ADD CONSTRAINT "quizzes_resultsPublishedBy_fkey"
  FOREIGN KEY ("resultsPublishedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── quiz_assignments ──────────────────────────────────────────────────────────

ALTER TABLE "quiz_assignments"
  DROP COLUMN IF EXISTS "dueDate",
  ADD COLUMN "joinedAt" TIMESTAMP(3);

-- ── quiz_attempts ─────────────────────────────────────────────────────────────

ALTER TABLE "quiz_attempts"
  ADD COLUMN "rank" INTEGER;

-- Replace old unique constraint (if it existed as internId+quizId) — already correct
-- Ensure the unique index exists as (internId, quizId) only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'quiz_attempts'
    AND indexname   = 'quiz_attempts_internId_quizId_key'
  ) THEN
    CREATE UNIQUE INDEX "quiz_attempts_internId_quizId_key"
      ON "quiz_attempts"("internId", "quizId");
  END IF;
END $$;

-- ── questions ─────────────────────────────────────────────────────────────────

-- Add unique constraint on (quizId, order) — fix duplicates first if any
-- Deduplicate by keeping the row with the lowest id
DELETE FROM "questions" q1
USING "questions" q2
WHERE q1."quizId" = q2."quizId"
  AND q1."order"  = q2."order"
  AND q1.id > q2.id;

CREATE UNIQUE INDEX IF NOT EXISTS "questions_quizId_order_key"
  ON "questions"("quizId", "order");

-- ── options ───────────────────────────────────────────────────────────────────

-- Add unique constraint on (questionId, order) — fix duplicates first if any
DELETE FROM "options" o1
USING "options" o2
WHERE o1."questionId" = o2."questionId"
  AND o1."order"      = o2."order"
  AND o1.id > o2.id;

CREATE UNIQUE INDEX IF NOT EXISTS "options_questionId_order_key"
  ON "options"("questionId", "order");

-- ── answers ───────────────────────────────────────────────────────────────────

-- Add FK from answers.questionId → questions.id (was missing)
ALTER TABLE "answers"
  ADD CONSTRAINT "answers_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "questions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Add updatedAt column
ALTER TABLE "answers"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── violations ────────────────────────────────────────────────────────────────

ALTER TABLE "violations"
  DROP COLUMN IF EXISTS "description";
