import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = neon(process.env.DATABASE_URL)
  
  console.log("Verifying all existing users...")
  
  const result = await sql`
    UPDATE users 
    SET "emailVerified" = NOW() 
    WHERE "emailVerified" IS NULL
  `
  
  // Note: the HTTP neon client might not return a rowCount property directly depending on the version, 
  // but we can query the users to verify.
  const verifiedUsers = await sql`SELECT count(*) FROM users WHERE "emailVerified" IS NOT NULL`
  
  console.log(`Success! All existing users have been verified.`)
  console.log(`Total verified users in database: ${verifiedUsers[0].count}`)
}

main().catch(console.error)
