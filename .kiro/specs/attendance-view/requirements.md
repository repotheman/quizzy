# Requirements Document

## Introduction

The Admin Attendance View is a real-time monitoring panel that allows admins to observe intern participation during a live quiz exam window. For each published quiz, the admin can see which interns have joined (started their attempt), which have not yet joined, and which are currently in progress — all updated via polling so the view stays current without a full page reload.

This feature is scoped to the admin panel and complements the existing Leaderboard page (which shows post-exam results). The Attendance View is specifically designed for use *during* an active exam window.

## Glossary

- **Admin**: A user with `role = 'ADMIN'` who manages quizzes and monitors interns.
- **Intern**: A user with `role = 'INTERN'` who takes quizzes.
- **Quiz**: A published assessment with a configurable time limit and join window (`startAt` / `endAt` on `quiz_assignments`).
- **Assignment**: A `quiz_assignments` row linking one intern to one quiz, with an optional join window (`startAt`, `endAt`) and an attendance timestamp (`joinedAt`).
- **Attempt**: A `quiz_attempts` row representing one intern's active or completed sitting of a quiz.
- **Attendance_Panel**: The client-side component that displays the live attendance grid and polls for updates.
- **Attendance_API**: The server-side API route that returns attendance data for a given quiz.
- **Join Window**: The period defined by `startAt` and `endAt` on a `quiz_assignments` row during which an intern may start the quiz.
- **Joined**: An intern whose `quiz_assignments.joinedAt` is not null — they have started their attempt.
- **Not Joined**: An intern whose `quiz_assignments.joinedAt` is null — they have been assigned but have not started.
- **In Progress**: An intern whose `quiz_attempts.status = 'IN_PROGRESS'` — they are actively taking the quiz right now.
- **Completed**: An intern whose attempt status is `SUBMITTED`, `TIMED_OUT`, or `TERMINATED`.
- **Polling Interval**: The fixed duration between successive Attendance_API requests made by the Attendance_Panel.

---

## Requirements

### Requirement 1: Attendance Panel Page

**User Story:** As an admin, I want a dedicated attendance monitoring page per quiz, so that I can observe intern participation in real time during an exam window.

#### Acceptance Criteria

1. THE Attendance_Panel SHALL be accessible at the route `/admin/quizzes/[quizId]/attendance`.
2. WHEN an unauthenticated user or a non-admin user navigates to the attendance route, THE Attendance_Panel SHALL redirect the user to `/login`.
3. THE Attendance_Panel SHALL display the quiz title, the join window (`startAt` / `endAt`), and the total number of assigned interns.
4. THE Attendance_Panel SHALL display a navigation link to the attendance page from the existing quiz detail page at `/admin/quizzes/[quizId]`.

---

### Requirement 2: Intern Status Classification

**User Story:** As an admin, I want each assigned intern to be classified into a clear status category, so that I can immediately understand who is present, absent, or still working.

#### Acceptance Criteria

1. THE Attendance_API SHALL classify each assigned intern into exactly one of three statuses: `NOT_JOINED`, `IN_PROGRESS`, or `COMPLETED`.
2. WHEN `quiz_assignments.joinedAt` is null for an intern, THE Attendance_API SHALL assign that intern the status `NOT_JOINED`.
3. WHEN `quiz_assignments.joinedAt` is not null and `quiz_attempts.status = 'IN_PROGRESS'`, THE Attendance_API SHALL assign that intern the status `IN_PROGRESS`.
4. WHEN `quiz_assignments.joinedAt` is not null and `quiz_attempts.status` is one of `SUBMITTED`, `TIMED_OUT`, or `TERMINATED`, THE Attendance_API SHALL assign that intern the status `COMPLETED`.
5. IF an intern has a `quiz_assignments` row but no corresponding `quiz_attempts` row, THEN THE Attendance_API SHALL assign that intern the status `NOT_JOINED`.

---

### Requirement 3: Attendance Data API

**User Story:** As an admin, I want a dedicated API endpoint that returns current attendance data for a quiz, so that the panel can poll for live updates.

#### Acceptance Criteria

1. THE Attendance_API SHALL expose a `GET /api/admin/quizzes/[quizId]/attendance` endpoint.
2. WHEN a valid `quizId` is provided and the requester is an authenticated admin, THE Attendance_API SHALL return a JSON response containing: the quiz metadata (title, `startAt`, `endAt`, `timeLimitMinutes`), and an array of intern attendance records.
3. WHEN an invalid or non-existent `quizId` is provided, THE Attendance_API SHALL return a `404` HTTP status with a descriptive error message.
4. WHEN the requester is not an authenticated admin, THE Attendance_API SHALL return a `401` HTTP status.
5. THE Attendance_API SHALL include the following fields per intern record: `internId`, `internName`, `internEmail`, `status` (`NOT_JOINED` | `IN_PROGRESS` | `COMPLETED`), `joinedAt`, `startedAt`, `violations`, and `attemptStatus`.
6. THE Attendance_API SHALL return the intern records sorted by status priority (`IN_PROGRESS` first, then `NOT_JOINED`, then `COMPLETED`) and alphabetically by name within each group.

---

### Requirement 4: Real-Time Polling

**User Story:** As an admin, I want the attendance panel to refresh automatically at a regular interval, so that I can monitor changes without manually reloading the page.

#### Acceptance Criteria

1. THE Attendance_Panel SHALL poll the Attendance_API at a fixed interval of 10 seconds while the page is mounted.
2. WHEN the browser tab becomes hidden (via the Page Visibility API), THE Attendance_Panel SHALL pause polling.
3. WHEN the browser tab becomes visible again, THE Attendance_Panel SHALL immediately resume polling and fetch fresh data.
4. THE Attendance_Panel SHALL display a "Last updated" timestamp that reflects the time of the most recent successful API response.
5. WHEN a polling request fails, THE Attendance_Panel SHALL retain the previously fetched data and display an error indicator without clearing the attendance grid.
6. THE Attendance_Panel SHALL display a visual indicator (e.g., a pulsing dot) to show that live polling is active.

---

### Requirement 5: Attendance Summary Counts

**User Story:** As an admin, I want to see aggregate counts at a glance, so that I can quickly assess overall participation without scanning the full list.

#### Acceptance Criteria

1. THE Attendance_Panel SHALL display a summary row showing the count of interns in each status: total assigned, joined (in progress + completed), not joined, in progress, and completed.
2. WHEN the attendance data changes between polls, THE Attendance_Panel SHALL update the summary counts to reflect the latest data.
3. THE Attendance_Panel SHALL display a join rate percentage, calculated as `(joined count / total assigned) * 100`, rounded to the nearest integer.

---

### Requirement 6: Attendance Grid Display

**User Story:** As an admin, I want to see each intern's attendance status in a clear table, so that I can identify specific individuals who have or have not joined.

#### Acceptance Criteria

1. THE Attendance_Panel SHALL render a table with one row per assigned intern, showing: intern name, intern email, status badge, join time (`joinedAt`), and current violation count.
2. THE Attendance_Panel SHALL render the status badge using distinct visual styles: amber/yellow for `IN_PROGRESS`, red for `NOT_JOINED`, and green/muted for `COMPLETED`.
3. WHEN an intern's status is `IN_PROGRESS`, THE Attendance_Panel SHALL display the elapsed time since `startedAt` in the table row.
4. WHEN an intern's status is `NOT_JOINED` and the join window has passed (current time > `endAt`), THE Attendance_Panel SHALL visually distinguish that intern as absent (e.g., dimmed row or "Absent" label).
5. THE Attendance_Panel SHALL support filtering the table by status (`All`, `In Progress`, `Not Joined`, `Completed`) using tab or button controls.

---

### Requirement 7: Exam Window Status Indicator

**User Story:** As an admin, I want to see whether the exam window is currently open, upcoming, or closed, so that I understand the context of the attendance data.

#### Acceptance Criteria

1. THE Attendance_Panel SHALL display an exam window status label: `UPCOMING` when the current time is before `startAt`, `OPEN` when the current time is between `startAt` and `endAt`, and `CLOSED` when the current time is after `endAt`.
2. WHEN either `startAt` or `endAt` is null on all assignments for the quiz, THE Attendance_Panel SHALL display `NO WINDOW SET` as the exam window status.
3. WHEN the exam window status is `OPEN`, THE Attendance_Panel SHALL render the status label with a green visual style.
4. WHEN the exam window status is `UPCOMING`, THE Attendance_Panel SHALL render the status label with a blue visual style.
5. WHEN the exam window status is `CLOSED`, THE Attendance_Panel SHALL render the status label with a muted/grey visual style.
