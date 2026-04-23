import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

type DbClient = ReturnType<typeof drizzle<typeof schema>>

let _db: DbClient | null = null

function getDb(): DbClient {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }
  const sql = neon(url)
  _db = drizzle(sql, { schema })
  return _db
}

// Proxy so consumers can import `db` at module scope without triggering
// a DB connection at build time. The first property access resolves the client.
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = getDb() as unknown as Record<string | symbol, unknown>
    const value = client[prop as string | symbol]
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return Reflect.get(client, prop, receiver)
  },
})
