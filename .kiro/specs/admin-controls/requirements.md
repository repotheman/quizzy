# Requirements Document

## Introduction

This feature adds four administrative control capabilities to the InternIQ quiz/exam management system. Admins currently have read-only visibility into in-progress and completed attempts. These controls give admins the ability to intervene in live attempts, correct scoring errors after the fact, retract published results, and export result data for offline analysis.

The four capabilities are:
1. **Terminate attempt** — forcibly end an in-progress attempt on behalf of an intern
2. **Override score** — adjust the computed score and pass/fail status of a finalized attempt
3. **Unpublish results** — revert a quiz's results from visible back to hidden
4. **Export results as CSV** — download all attempt data for a quiz as a CSV file

## Glossary

- **Admin**: A user with `role = 'ADMIN'` who manages quizzes and interns.
- **Intern**: A user with `role = 'INTERN'` who takes assigned quizzes.
- **Attempt**: A `quiz_attempts` row representing one intern's sitting of one quiz. Has a `status` of `IN_PROGRESS`, `SUBMITTED`, `TIMED_OUT`, or `TERMINATED`.
- **Finalized Attempt**: An attempt whose `status` is `SUBMITTED`, `TIMED_OUT`, or `TERMINATED` (i.e., not `IN_PROGRESS`).
- **Score_Override**: An admin-supplied raw score value that replaces the system-computed score on a finalized attempt.
- **Published Results**: A quiz whose `resultsPublishedAt` column is non-null, making scores and ranks visible to interns.
- **Unpublish**: The act of setting `resultsPublishedAt` back to `NULL`, hiding results from interns.
- **CSV_Export**: A comma-separated values file containing one row per finalized attempt for a given quiz.
- **Audit_Log**: A record of admin actions (termination, score override, unpublish) stored for accountability.

---

## Requirements

### Requirement 1: Terminate an In-Progress Attempt

**User Story:** As an Admin, I want to manually terminate an intern's in-progress attempt, so that I can intervene when an intern is suspected of cheating, has a technical issue, or needs to be removed from an active exam session.

#### Acceptance Criteria

1. WHEN an Admin requests termination of an attempt, THE Admin_Controls_API SHALL verify the attempt exists and has `status = 'IN_PROGRESS'` before proceeding.
2. WHEN an Admin terminates an in-progress attempt, THE Admin_Controls_API SHALL finalize the attempt using the existing `finalizeAttempt` function with `reason = "TERMINATED"`, scoring all submitted answers at the time of termination.
3. WHEN an Admin terminates an attempt, THE Admin_Controls_API SHALL record an Audit_Log entry containing the admin's user ID, the attempt ID, the action type `"ADMIN_TERMINATED"`, and a timestamp.
4. WHEN an Admin provides an optional reason string for termination, THE Admin_Controls_API SHALL store that reason in the Audit_Log entry.
5. IF an Admin requests termination of an attempt whose `status` is not `IN_PROGRESS`, THEN THE Admin_Controls_API SHALL return a 409 Conflict response with a descriptive error message.
6. IF an Admin requests termination of an attempt that does not exist, THEN THE Admin_Controls_API SHALL return a 404 Not Found response.
7. WHEN an attempt is successfully terminated by an Admin, THE Results_UI SHALL reflect the updated `TERMINATED` status without requiring a full page reload.
8. THE Admin_Controls_API SHALL reject termination requests from users whose `role` is not `ADMIN`, returning a 401 Unauthorized response.

---

### Requirement 2: Override a Score After the Fact

**User Story:** As an Admin, I want to override the computed score of a finalized attempt, so that I can correct grading errors, account for technical issues during the exam, or apply manual adjustments.

#### Acceptance Criteria

1. WHEN an Admin submits a Score_Override for a finalized attempt, THE Admin_Controls_API SHALL accept a `scoreOverride` value that is a non-negative integer not exceeding the attempt's `totalPoints`.
2. WHEN a Score_Override is applied, THE Admin_Controls_API SHALL recompute `percentage` as `round((scoreOverride / totalPoints) * 1000) / 10` and update `passed` based on the quiz's `passingScore` threshold.
3. WHEN a Score_Override is applied, THE Admin_Controls_API SHALL update the attempt row with the new `score`, `percentage`, and `passed` values.
4. WHEN a Score_Override is applied, THE Admin_Controls_API SHALL record an Audit_Log entry containing the admin's user ID, the attempt ID, the action type `"SCORE_OVERRIDE"`, the previous score, the new score, and a timestamp.
5. WHEN a Score_Override is applied to an attempt whose quiz has Published Results, THE Admin_Controls_API SHALL recompute and update the `rank` for all finalized attempts of that quiz.
6. IF an Admin submits a `scoreOverride` value that is negative or exceeds `totalPoints`, THEN THE Admin_Controls_API SHALL return a 422 Unprocessable Entity response with a descriptive validation error.
7. IF an Admin requests a Score_Override for an attempt whose `status` is `IN_PROGRESS`, THEN THE Admin_Controls_API SHALL return a 409 Conflict response.
8. IF an Admin requests a Score_Override for an attempt that does not exist, THEN THE Admin_Controls_API SHALL return a 404 Not Found response.
9. THE Admin_Controls_API SHALL reject score override requests from users whose `role` is not `ADMIN`, returning a 401 Unauthorized response.
10. WHEN a Score_Override is applied, THE Attempt_Details_UI SHALL display a visual indicator showing that the score was manually adjusted by an Admin.

---

### Requirement 3: Unpublish Results

**User Story:** As an Admin, I want to revert a quiz's results from published back to hidden, so that I can correct errors in published data, apply score overrides before re-publishing, or retract results for any administrative reason.

#### Acceptance Criteria

1. WHEN an Admin requests to unpublish results for a quiz, THE Admin_Controls_API SHALL verify the quiz exists and has `resultsPublishedAt` set to a non-null value before proceeding.
2. WHEN an Admin unpublishes results, THE Admin_Controls_API SHALL set `resultsPublishedAt` to `NULL` and `resultsPublishedBy` to `NULL` on the quiz row.
3. WHEN results are unpublished, THE Admin_Controls_API SHALL clear the `rank` column on all finalized attempts for that quiz, setting it to `NULL`.
4. WHEN an Admin unpublishes results, THE Admin_Controls_API SHALL record an Audit_Log entry containing the admin's user ID, the quiz ID, the action type `"RESULTS_UNPUBLISHED"`, the previous `resultsPublishedAt` timestamp, and a new timestamp.
5. IF an Admin requests to unpublish results for a quiz whose `resultsPublishedAt` is already `NULL`, THEN THE Admin_Controls_API SHALL return a 409 Conflict response with a descriptive error message.
6. IF an Admin requests to unpublish results for a quiz that does not exist, THEN THE Admin_Controls_API SHALL return a 404 Not Found response.
7. WHEN results are unpublished, THE Leaderboard_UI SHALL immediately hide scores and ranks from the intern-facing view.
8. WHEN results are unpublished, THE Leaderboard_UI SHALL display an "Unpublish Results" button in place of the published status indicator, allowing the Admin to re-publish.
9. THE Admin_Controls_API SHALL reject unpublish requests from users whose `role` is not `ADMIN`, returning a 401 Unauthorized response.

---

### Requirement 4: Export Results as CSV

**User Story:** As an Admin, I want to export all finalized attempt results for a quiz as a CSV file, so that I can perform offline analysis, share results with stakeholders, or archive data outside the system.

#### Acceptance Criteria

1. WHEN an Admin requests a CSV export for a quiz, THE CSV_Export_API SHALL return a file with `Content-Type: text/csv` and a `Content-Disposition` header specifying a filename in the format `results-{quiz-title-slug}-{YYYY-MM-DD}.csv`.
2. THE CSV_Export_API SHALL include one header row with the following columns: `attempt_id`, `intern_name`, `intern_email`, `status`, `score`, `total_points`, `percentage`, `passed`, `rank`, `violations`, `time_spent_seconds`, `started_at`, `submitted_at`.
3. THE CSV_Export_API SHALL include one data row per finalized attempt (status is not `IN_PROGRESS`) for the requested quiz, ordered by `percentage DESC`, `time_spent_seconds ASC`.
4. WHEN a quiz has no finalized attempts, THE CSV_Export_API SHALL return a CSV file containing only the header row.
5. IF an Admin requests a CSV export for a quiz that does not exist, THEN THE CSV_Export_API SHALL return a 404 Not Found response.
6. THE CSV_Export_API SHALL reject export requests from users whose `role` is not `ADMIN`, returning a 401 Unauthorized response.
7. WHEN an Admin clicks the export button in the Results_UI or Leaderboard_UI, THE Export_Button SHALL trigger a browser file download of the CSV without navigating away from the current page.
8. THE CSV_Export_API SHALL escape any field values that contain commas, double-quotes, or newline characters by wrapping them in double-quotes and escaping internal double-quotes as `""`.

---

### Requirement 5: Audit Log Persistence

**User Story:** As an Admin, I want all administrative control actions to be recorded in an audit log, so that there is an accountable history of who changed what and when.

#### Acceptance Criteria

1. THE System SHALL persist Audit_Log entries in a dedicated `admin_audit_log` database table containing: `id`, `adminId`, `action`, `targetType` (`"attempt"` or `"quiz"`), `targetId`, `metadata` (JSON), and `createdAt`.
2. WHEN an Audit_Log entry is created, THE System SHALL set `createdAt` to the current server timestamp.
3. THE System SHALL store Score_Override metadata as a JSON object with keys `previousScore`, `newScore`, and optionally `reason`.
4. THE System SHALL store termination metadata as a JSON object with key `reason` (the admin-supplied reason string, or `null` if not provided).
5. THE System SHALL store unpublish metadata as a JSON object with key `previousPublishedAt` (the ISO timestamp of the prior publication).
