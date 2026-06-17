import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const domain = process.env.AUTH_URL || "http://localhost:3000"
const fromEmail = "Quizzy <onboarding@resend.dev>" // Replace with your domain when ready

// Helper to wrap email content in a premium, modern layout
function getEmailTemplate(title: string, content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px 30px;
      color: #374151;
      font-size: 16px;
      line-height: 1.6;
    }
    .content h2 {
      color: #111827;
      font-size: 24px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .button-container {
      text-align: center;
      margin: 35px 0;
    }
    .button {
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 16px;
      display: inline-block;
      transition: background-color 0.2s ease;
      box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -2px rgba(79, 70, 229, 0.2);
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      color: #6b7280;
      font-size: 14px;
      margin: 0;
    }
    .data-card {
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #4f46e5;
    }
    .data-card p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quizzy</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p style="margin-top: 8px;">&copy; ${new Date().getFullYear()} Quizzy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
}

export async function sendVerificationEmail(email: string, token: string) {
  const confirmLink = `${domain}/verify-email?token=${token}`

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Welcome to Quizzy! Verify your account",
    html: getEmailTemplate(
      "Verify Email",
      `
        <h2>Welcome to the team! 🎉</h2>
        <p>We're thrilled to have you on board. To get started and unlock full access to your intern dashboard, please confirm your email address.</p>
        <div class="button-container">
          <a href="${confirmLink}" class="button">Verify My Email</a>
        </div>
        <p>This link will expire soon, so be sure to click it right away!</p>
      `
    ),
  })

  if (error) {
    console.error("Resend Error (Verification):", error)
    throw new Error(error.message)
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${domain}/reset-password?token=${token}`

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Reset your Quizzy password",
    html: getEmailTemplate(
      "Reset Password",
      `
        <h2>Password Reset Request 🔒</h2>
        <p>We received a request to reset the password associated with your Quizzy account. No worries, it happens to the best of us!</p>
        <div class="button-container">
          <a href="${resetLink}" class="button">Reset Password</a>
        </div>
        <p>If you didn't initiate this request, your account is perfectly safe and you don't need to do anything else.</p>
      `
    ),
  })

  if (error) {
    console.error("Resend Error (Password Reset):", error)
    throw new Error(error.message)
  }
}

export async function sendQuizAssignmentEmail(email: string, quizTitle: string, startAt: Date | null, endAt: Date | null) {
  const loginLink = `${domain}/login`
  
  let timeHtml = ""
  if (startAt && endAt) {
    timeHtml = `
      <p><strong>Available from:</strong> ${startAt.toLocaleString()}</p>
      <p><strong>Available until:</strong> ${endAt.toLocaleString()}</p>
    `
  } else if (startAt) {
    timeHtml = `<p><strong>Available from:</strong> ${startAt.toLocaleString()}</p>`
  } else if (endAt) {
    timeHtml = `<p><strong>Available until:</strong> ${endAt.toLocaleString()}</p>`
  } else {
    timeHtml = `<p><strong>Status:</strong> Available to take immediately.</p>`
  }

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `New Quiz Assigned: ${quizTitle}`,
    html: getEmailTemplate(
      "New Quiz Assigned",
      `
        <h2>You have a new quiz! 📝</h2>
        <p>A new quiz has just been assigned to your dashboard and requires your attention.</p>
        
        <div class="data-card">
          <p><strong>Quiz Topic:</strong> ${quizTitle}</p>
          ${timeHtml}
        </div>

        <div class="button-container">
          <a href="${loginLink}" class="button">Go to Dashboard</a>
        </div>
        <p>Good luck and do your best!</p>
      `
    ),
  })

  if (error) {
    console.error("Resend Error (Quiz Assignment):", error)
    // We do not throw here because failing to send an assignment email 
    // should not crash the assignment process itself.
  }
}
