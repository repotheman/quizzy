import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

// Root page — redirect to the right dashboard based on role.
// The middleware handles unauthenticated users (sends them to /login),
// so by the time we get here we always have a session.
export default async function RootPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin")
  }

  redirect("/intern")
}
