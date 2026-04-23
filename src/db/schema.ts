import { pgTable, uuid, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core"

export const clientStatus = pgEnum("client_status", [
  "invited",
  "active",
  "archived",
])

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    company: text("company"),
    clerkUserId: text("clerk_user_id").unique(),
    status: clientStatus("status").notNull().default("invited"),
    createdBy: text("created_by").notNull(), // Clerk user id of the agency member who created the client
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    clientsEmailIdx: index("clients_email_idx").on(table.email),
    clientsStatusIdx: index("clients_status_idx").on(table.status),
  }),
)

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
