-- Migration: Add admin_audit_log table and quiz_attempts override columns
-- Requirements: 5.1, 5.2

-- New audit log table for admin actions
CREATE TABLE admin_audit_log (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminId"    TEXT        NOT NULL REFERENCES users(id),
  action       TEXT        NOT NULL,   -- 'ADMIN_TERMINATED' | 'SCORE_OVERRIDE' | 'RESULTS_UNPUBLISHED'
  "targetType" TEXT        NOT NULL,   -- 'attempt' | 'quiz'
  "targetId"   TEXT        NOT NULL,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_target ON admin_audit_log ("targetType", "targetId");
CREATE INDEX idx_audit_log_admin  ON admin_audit_log ("adminId");

-- New columns on quiz_attempts to track manual score overrides
ALTER TABLE quiz_attempts ADD COLUMN "scoreOverriddenAt" TIMESTAMPTZ;
ALTER TABLE quiz_attempts ADD COLUMN "scoreOverriddenBy" TEXT REFERENCES users(id);
