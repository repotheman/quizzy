import { sql } from "./lib/db"

async function main() {
  const email = "ripudamansingh2004@gmail.com" 
  const users = await sql`SELECT * FROM users WHERE email = ${email}`
  if (users.length === 0) {
    console.log("User not found")
    return
  }
  const user = users[0]
  console.log("User found:", user.email, "emailVerified:", user.emailVerified)
}
main()
