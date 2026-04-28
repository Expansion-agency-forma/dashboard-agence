import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Adding signature fields to quotes…")
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_name text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_ip text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_user_agent text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone`
  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
