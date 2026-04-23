import { pgTable, uuid, text, timestamp, pgEnum, index, integer } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const clientStatus = pgEnum("client_status", [
  "invited",
  "active",
  "archived",
])

export const stepStatus = pgEnum("step_status", [
  "pending",
  "in_progress",
  "done",
])

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    company: text("company"),
    clerkUserId: text("clerk_user_id").unique(),
    invitationId: text("invitation_id"),
    invitationUrl: text("invitation_url"),
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

export const onboardingSteps = pgTable(
  "onboarding_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    stepOrder: integer("step_order").notNull(),
    status: stepStatus("status").notNull().default("pending"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stepsClientIdx: index("steps_client_idx").on(table.clientId),
    stepsOrderIdx: index("steps_order_idx").on(table.clientId, table.stepOrder),
  }),
)

export const clientsRelations = relations(clients, ({ many }) => ({
  steps: many(onboardingSteps),
}))

export const stepsRelations = relations(onboardingSteps, ({ one }) => ({
  client: one(clients, {
    fields: [onboardingSteps.clientId],
    references: [clients.id],
  }),
}))

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type OnboardingStep = typeof onboardingSteps.$inferSelect
export type NewOnboardingStep = typeof onboardingSteps.$inferInsert
