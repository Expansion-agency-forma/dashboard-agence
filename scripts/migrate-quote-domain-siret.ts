import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Adding prospect_domain + prospect_siret to quotes…")
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_domain text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_siret text`

  console.log("Adding domain to clients…")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS domain text`

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
