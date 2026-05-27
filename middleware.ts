import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth
  const userRole = req.auth?.user?.role

  // Public routes
  const publicRoutes = ["/login", "/register"]
  if (publicRoutes.includes(pathname)) {
    if (isAuthenticated) {
      // Redirect authenticated users away from auth pages
      const redirectTo = userRole === "ADMIN" ? "/admin" : "/intern"
      return NextResponse.redirect(new URL(redirectTo, req.url))
    }
    return NextResponse.next()
  }

  // Protected routes - require authentication
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Admin routes - require ADMIN role
  if (pathname.startsWith("/admin")) {
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/intern", req.url))
    }
  }

  // Intern routes - require INTERN role
  if (pathname.startsWith("/intern")) {
    if (userRole !== "INTERN") {
      return NextResponse.redirect(new URL("/admin", req.url))
    }
  }

  // Root redirect based on role
  if (pathname === "/") {
    const redirectTo = userRole === "ADMIN" ? "/admin" : "/intern"
    return NextResponse.redirect(new URL(redirectTo, req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|fevicon.png|icon-light-32x32.png|icon-dark-32x32.png|icon.svg|apple-icon.png).*)",
  ],
}
