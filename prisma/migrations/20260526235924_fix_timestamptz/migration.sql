-- ============================================================
-- Migration: fix_timestamptz
-- Convert all timestamp columns to timestamptz (with time zone).
-- Previously Prisma generated "timestamp without time zone" which
-- causes incorrect comparisons with NOW() (which is timestamptz).
-- ============================================================

-- users
ALTER TABLE "users"
  ALTER COLUMN "createdAt"  TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt"  TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';

-- quizzes
ALTER TABLE "quizzes"
  ALTER COLUMN "resultsPublishedAt" TYPE TIMESTAMPTZ USING "resultsPublishedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt"          TYPE TIMESTAMPTZ USING "createdAt"          AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt"          TYPE TIMESTAMPTZ USING "updatedAt"          AT TIME ZONE 'UTC';

-- questions
ALTER TABLE "questions"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';

-- quiz_assignments
ALTER TABLE "quiz_assignments"
  ALTER COLUMN "startAt"    TYPE TIMESTAMPTZ USING "startAt"    AT TIME ZONE 'UTC',
  ALTER COLUMN "endAt"      TYPE TIMESTAMPTZ USING "endAt"      AT TIME ZONE 'UTC',
  ALTER COLUMN "joinedAt"   TYPE TIMESTAMPTZ USING "joinedAt"   AT TIME ZONE 'UTC',
  ALTER COLUMN "assignedAt" TYPE TIMESTAMPTZ USING "assignedAt" AT TIME ZONE 'UTC';

-- quiz_attempts
ALTER TABLE "quiz_attempts"
  ALTER COLUMN "startedAt"   TYPE TIMESTAMPTZ USING "startedAt"   AT TIME ZONE 'UTC',
  ALTER COLUMN "submittedAt" TYPE TIMESTAMPTZ USING "submittedAt" AT TIME ZONE 'UTC';

-- answers
ALTER TABLE "answers"
  ALTER COLUMN "answeredAt" TYPE TIMESTAMPTZ USING "answeredAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt"  TYPE TIMESTAMPTZ USING "updatedAt"  AT TIME ZONE 'UTC';

-- violations
ALTER TABLE "violations"
  ALTER COLUMN "timestamp" TYPE TIMESTAMPTZ USING "timestamp" AT TIME ZONE 'UTC';
