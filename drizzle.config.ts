import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// Drizzle CLI runs outside Next.js, so we load .env.local manually.
config({ path: ".env.local" })

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — check .env.local")
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
