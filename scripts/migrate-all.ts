/**
 * Consolidated, idempotent migration script. Applies every schema change made
 * since the initial release. Safe to re-run multiple times.
 *
 * To target prod: create a `.env.prod-migration` file at the repo root with:
 *     DATABASE_URL=postgresql://...   (the prod connection string from Neon)
 * Then run: `npx tsx scripts/migrate-all.ts`
 * Delete the file when done.
 *
 * Falls back to .env.local if .env.prod-migration is absent (useful for dev).
 */
import { existsSync } from "node:fs"
import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

const prodEnvPath = ".env.prod-migration"
if (existsSync(prodEnvPath)) {
  console.log(`Loading DATABASE_URL from ${prodEnvPath}…`)
  config({ path: prodEnvPath })
} else {
  console.log("Loading DATABASE_URL from .env.local…")
  config({ path: ".env.local" })
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}
const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log("→ Phase 1 — billing fields on clients")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_name text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_address_line1 text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_address_line2 text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_postal_code text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_city text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'FR'`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS siret text`

  console.log("→ Phase 2 — formation_days + monthly_pub_revenue")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS formation_days integer`
  await sql`
    DO $$ BEGIN
      CREATE TYPE revenue_declaration_status AS ENUM ('pending', 'declared', 'validated', 'invoiced');
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `
  await sql`
    CREATE TABLE IF NOT EXISTS monthly_pub_revenue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      period_month text NOT NULL,
      declared_revenue_cents integer,
      declared_at timestamp with time zone,
      validated_revenue_cents integer,
      validated_at timestamp with time zone,
      validated_by text,
      notes text,
      status revenue_declaration_status NOT NULL DEFAULT 'pending',
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS revenue_client_period_idx ON monthly_pub_revenue (client_id, period_month)`
  await sql`CREATE INDEX IF NOT EXISTS revenue_status_idx ON monthly_pub_revenue (status)`

  console.log("→ Phase 3.1 — stripe_customer_id + invoices")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id text`
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_stripe_customer_id_unique') THEN
        ALTER TABLE clients ADD CONSTRAINT clients_stripe_customer_id_unique UNIQUE (stripe_customer_id);
      END IF;
    END $$
  `
  await sql`
    DO $$ BEGIN
      CREATE TYPE invoice_status AS ENUM ('open', 'paid', 'uncollectible', 'void');
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `
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
  await sql`CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices (client_id)`
  await sql`CREATE INDEX IF NOT EXISTS invoices_period_idx ON invoices (client_id, period_month)`
  await sql`CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status)`

  console.log("→ formation_travel_cents on clients")
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS formation_travel_cents integer`

  console.log("→ Phase 4 — quotes table")
  await sql`
    DO $$ BEGIN
      CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `
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
  await sql`CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status)`
  await sql`CREATE INDEX IF NOT EXISTS quotes_email_idx ON quotes (prospect_email)`
  await sql`CREATE INDEX IF NOT EXISTS quotes_token_idx ON quotes (public_token)`

  console.log("→ quotes deposit fields")
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_amount_cents integer`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_stripe_session_id text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_paid_at timestamp with time zone`
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_deposit_stripe_session_id_unique') THEN
        ALTER TABLE quotes ADD CONSTRAINT quotes_deposit_stripe_session_id_unique UNIQUE (deposit_stripe_session_id);
      END IF;
    END $$
  `

  console.log("→ quotes domain/siret + clients.domain")
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_domain text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_siret text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS domain text`

  console.log("→ quotes signature fields")
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_name text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_ip text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_user_agent text`
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone`

  console.log("✓ All migrations applied.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
