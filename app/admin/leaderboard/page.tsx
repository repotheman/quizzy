import { redirect } from "next/navigation"

// Leaderboard has been merged into the Results page.
// This redirect ensures any existing links or bookmarks still work.
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ quizId?: string }>
}) {
  const { quizId } = await searchParams
  const dest = quizId
    ? `/admin/results?quizId=${quizId}&tab=rankings`
    : "/admin/results?tab=rankings"
  redirect(dest)
}
