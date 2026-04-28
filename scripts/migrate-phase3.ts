import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Adding stripe_customer_id to clients…")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id text`
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'clients_stripe_customer_id_unique'
      ) THEN
        ALTER TABLE clients
          ADD CONSTRAINT clients_stripe_customer_id_unique UNIQUE (stripe_customer_id);
      END IF;
    END $$
  `

  console.log("Creating invoice_status enum…")
  await sql`
    DO $$ BEGIN
      CREATE TYPE invoice_status AS ENUM ('open', 'paid', 'uncollectible', 'void');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `

  console.log("Creating invoices table…")
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      service_type text NOT NULL,
      period_month text,
      amount_cents integer NOT NULL,
      status invoice_status NOT NULL DEFAULT 'open',
      stripe_invoice_id text NOT NULL UNIQUE,
      stripe_invoice_number text,
      stripe_hosted_invoice_url text,
      stripe_invoice_pdf_url text,
      issued_at timestamp with time zone NOT NULL DEFAULT now(),
      paid_at timestamp with time zone,
      issued_by text NOT NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `

  console.log("Creating indexes…")
  await sql`CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices (client_id)`
  await sql`CREATE INDEX IF NOT EXISTS invoices_period_idx ON invoices (client_id, period_month)`
  await sql`CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status)`

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
