import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log("Dropping old columns…")
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS meta_business_id`
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS meta_page_url`
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS meta_pixel_id`
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS meta_ad_account_id`
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS tiktok_handle`
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS youtube_channel_url`
  await sql`ALTER TABLE client_access DROP COLUMN IF EXISTS snapchat_handle`

  console.log("Adding new columns…")
  await sql`ALTER TABLE client_access ADD COLUMN IF NOT EXISTS facebook_email text`
  await sql`ALTER TABLE client_access ADD COLUMN IF NOT EXISTS facebook_password_enc text`
  await sql`ALTER TABLE client_access ADD COLUMN IF NOT EXISTS instagram_email text`
  await sql`ALTER TABLE client_access ADD COLUMN IF NOT EXISTS instagram_password_enc text`

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
