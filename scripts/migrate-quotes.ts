import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Creating quote_status enum…")
  await sql`
    DO $$ BEGIN
      CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `

  console.log("Creating quotes table…")
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      public_token text NOT NULL UNIQUE,
      prospect_name text NOT NULL,
      prospect_email text NOT NULL,
      prospect_company text,
      services text[] NOT NULL,
      pub_expected_monthly_revenue_cents integer,
      formation_days integer,
      formation_travel_cents integer,
      notes text,
      status quote_status NOT NULL DEFAULT 'draft',
      expires_at timestamp with time zone NOT NULL,
      sent_at timestamp with time zone,
      accepted_at timestamp with time zone,
      rejected_at timestamp with time zone,
      client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
      created_by text NOT NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `

  console.log("Creating indexes…")
  await sql`CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status)`
  await sql`CREATE INDEX IF NOT EXISTS quotes_email_idx ON quotes (prospect_email)`
  await sql`CREATE INDEX IF NOT EXISTS quotes_token_idx ON quotes (public_token)`

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
