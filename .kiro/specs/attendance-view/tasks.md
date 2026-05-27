# Tasks

## Task List

- [x] 1. Create the Attendance API route
  - [x] 1.1 Create `app/api/admin/quizzes/[quizId]/attendance/route.ts` with a `GET` handler
  - [x] 1.2 Add auth guard: return 401 if not authenticated or not ADMIN
  - [x] 1.3 Query quiz metadata (title, timeLimitMinutes, MIN(startAt), MAX(endAt)) via raw SQL
  - [x] 1.4 Return 404 with `{ error: "Quiz not found" }` when quizId does not exist
  - [x] 1.5 Query all assigned interns with a LEFT JOIN to quiz_attempts, ordered by status priority then name
  - [x] 1.6 Map each DB row to an `AttendanceRecord` using `classifyIntern` logic
  - [x] 1.7 Return the full `AttendanceResponse` JSON including `fetchedAt` server timestamp

- [x] 2. Implement pure utility functions (shared between API and client)
  - [x] 2.1 Implement `classifyIntern(row)` → `AttendanceStatus`
  - [x] 2.2 Implement `getWindowStatus(startAt, endAt, now)` → `WindowStatus`
  - [x] 2.3 Implement `computeSummary(interns)` → `AttendanceSummary`
  - [x] 2.4 Implement `formatElapsed(startedAt)` → string using `date-fns`

- [x] 3. Create the attendance server page
  - [x] 3.1 Create `app/admin/quizzes/[quizId]/attendance/page.tsx` as an async server component
  - [x] 3.2 Call `auth()` and redirect to `/login` if not authenticated or not ADMIN
  - [x] 3.3 Fetch initial attendance data server-side by calling the same SQL queries as the API route
  - [x] 3.4 Pass initial data as props to `<AttendancePanel>`

- [x] 4. Create the AttendancePanel client component
  - [x] 4.1 Create `app/admin/quizzes/[quizId]/attendance/attendance-panel.tsx` with `"use client"`
  - [x] 4.2 Render the quiz title, exam window dates, and `WindowStatus` badge (UPCOMING/OPEN/CLOSED/NO WINDOW SET) with correct color variants
  - [x] 4.3 Render the six summary stat cards: Total, Joined, Not Joined, In Progress, Completed, Join Rate %
  - [x] 4.4 Implement polling with `useEffect` + `setInterval` at 10-second intervals
  - [x] 4.5 Implement Page Visibility API: pause polling on `hidden`, resume + immediate fetch on `visible`
  - [x] 4.6 Render the live polling indicator (pulsing green dot) and "Last updated" timestamp
  - [x] 4.7 On polling error, retain previous data and display an error banner (do not clear the grid)
  - [x] 4.8 Render filter tabs: All / In Progress / Not Joined / Completed
  - [x] 4.9 Render the attendance table with columns: Name, Email, Status badge, Joined At, Elapsed (IN_PROGRESS only), Violations
  - [x] 4.10 Apply absent styling (dimmed row + "Absent" label) for NOT_JOINED interns when window is CLOSED
  - [x] 4.11 Use distinct badge variants: amber for IN_PROGRESS, red for NOT_JOINED, green for COMPLETED

- [x] 5. Update the quiz detail page
  - [x] 5.1 Add an "Attendance" button/link to `app/admin/quizzes/[quizId]/page.tsx` pointing to `/admin/quizzes/[quizId]/attendance`

- [x] 6. Write property-based tests for pure utility functions
  - [x] 6.1 Property 1: `classifyIntern` always returns one of three valid statuses for any input combination
  - [x] 6.2 Property 3: sorted intern list always satisfies the status-priority + alphabetical ordering invariant
  - [x] 6.3 Property 4: `computeSummary` counts are always consistent with the input array
  - [x] 6.4 Property 5: `joinRate` always equals `Math.round((joined / total) * 100)` for any valid (joined, total) pair
  - [x] 6.5 Property 6: `formatElapsed` always returns a non-negative duration string for any past timestamp
  - [x] 6.6 Property 7: filter function returns only records matching the filter value for any input array
  - [x] 6.7 Property 8: `getWindowStatus` returns the correct status for all (startAt, endAt, now) combinations including null cases
