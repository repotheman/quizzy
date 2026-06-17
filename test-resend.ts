import { sendPasswordResetEmail } from "./lib/mail"

async function main() {
  try {
    console.log("Attempting to send email...")
    await sendPasswordResetEmail("test@example.com", "dummy-token")
    console.log("Email sent successfully!")
  } catch (err) {
    console.error("Failed to send email:", err)
  }
}

main()
