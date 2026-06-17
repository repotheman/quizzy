import { sql } from "./lib/db"

async function main() {
  const email = "ripudamansingh2004@gmail.com" 
  await sql`UPDATE users SET "emailVerified" = NOW() WHERE email = ${email}`
  console.log("Successfully verified user:", email)
}
main()
