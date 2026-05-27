/**
 * Exam layout — intentionally renders children directly with no sidebar,
 * no header, and no padding. The ExamShell manages its own full-screen UI.
 *
 * This layout is nested inside app/intern/layout.tsx (which provides the
 * SidebarProvider), but we bypass the SidebarInset wrapper by rendering
 * outside of it. Since Next.js layouts are nested, we need to override the
 * intern layout's chrome. We do this by rendering a fixed full-screen portal
 * that sits on top of everything.
 */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )
}
