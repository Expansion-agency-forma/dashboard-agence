import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Adding formation_travel_cents to clients…")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS formation_travel_cents integer`
  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
