import { sql } from "@/lib/db"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | "ADMIN_TERMINATED"
  | "SCORE_OVERRIDE"
  | "RESULTS_UNPUBLISHED"

export interface AuditLogEntry {
  id: string
  adminId: string
  action: AuditAction
  targetType: "attempt" | "quiz"
  targetId: string
  metadata: Record<string, unknown>
  createdAt: Date
}

// ─── Write audit log ──────────────────────────────────────────────────────────

/**
 * Inserts a row into admin_audit_log.
 *
 * Non-fatal: if the insert fails, the error is logged server-side but not
 * re-thrown. Audit log failures must not block the primary admin action.
 */
export async function writeAuditLog(
  entry: Omit<AuditLogEntry, "id" | "createdAt">
): Promise<void> {
  try {
    await sql`
      INSERT INTO admin_audit_log ("adminId", action, "targetType", "targetId", metadata)
      VALUES (
        ${entry.adminId},
        ${entry.action},
        ${entry.targetType},
        ${entry.targetId},
        ${JSON.stringify(entry.metadata)}
      )
    `
  } catch (err) {
    console.error("[audit] Failed to write audit log entry:", err)
  }
}
