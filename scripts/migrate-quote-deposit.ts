import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Adding deposit fields to quotes…")
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_amount_cents integer`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_stripe_session_id text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_paid_at timestamp with time zone`
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'quotes_deposit_stripe_session_id_unique'
      ) THEN
        ALTER TABLE quotes
          ADD CONSTRAINT quotes_deposit_stripe_session_id_unique UNIQUE (deposit_stripe_session_id);
      END IF;
    END $$
  `
  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
