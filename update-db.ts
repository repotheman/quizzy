import { sql } from "./lib/db"

async function main() {
  console.log("Updating database schema...")
  
  try {
    console.log("Adding emailVerified to users...")
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMPTZ`

    console.log("Creating verification_tokens table...")
    await sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS verification_tokens_email_token_key ON verification_tokens(email, token)`

    console.log("Creating password_reset_tokens table...")
    await sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_email_token_key ON password_reset_tokens(email, token)`

    console.log("Backfilling existing users as verified...")
    await sql`UPDATE users SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL`

    console.log("Successfully updated database!")
  } catch (err) {
    console.error("Failed to update db", err)
    process.exit(1)
  }
}

main()
