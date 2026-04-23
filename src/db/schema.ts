import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core"
import { relations, sql } from "drizzle-orm"

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
    services: text("services")
      .array()
      .notNull()
      .default(sql`ARRAY['pub']::text[]`),
    shootDate: timestamp("shoot_date", { withTimezone: true }),
    adAccountCreatedAt: timestamp("ad_account_created_at", { withTimezone: true }),
    adAccountName: text("ad_account_name"),
    adAccountCardConfirmedAt: timestamp("ad_account_card_confirmed_at", {
      withTimezone: true,
    }),
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

export const clientFiles = pgTable(
  "client_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => onboardingSteps.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    pathname: text("pathname").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type"),
    size: integer("size").notNull(),
    description: text("description"),
    uploadedBy: text("uploaded_by").notNull(), // Clerk user id
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    filesClientIdx: index("files_client_idx").on(table.clientId),
    filesStepIdx: index("files_step_idx").on(table.stepId),
  }),
)

export const clientAccess = pgTable("client_access", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  facebookEmail: text("facebook_email"),
  facebookPasswordEnc: text("facebook_password_enc"), // AES-256-GCM encrypted at rest
  instagramEmail: text("instagram_email"),
  instagramPasswordEnc: text("instagram_password_enc"),
  notes: text("notes"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const filesRelations = relations(clientFiles, ({ one }) => ({
  client: one(clients, {
    fields: [clientFiles.clientId],
    references: [clients.id],
  }),
  step: one(onboardingSteps, {
    fields: [clientFiles.stepId],
    references: [onboardingSteps.id],
  }),
}))

export const accessRelations = relations(clientAccess, ({ one }) => ({
  client: one(clients, {
    fields: [clientAccess.clientId],
    references: [clients.id],
  }),
}))

export const clientIntake = pgTable("client_intake", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  brandName: text("brand_name"),
  targetAudience: text("target_audience"),
  topProblems: text("top_problems"),
  offerDifferentiator: text("offer_differentiator"),
  topBenefits: text("top_benefits"),
  commonObjections: text("common_objections"),
  objectionResponses: text("objection_responses"),
  brandStory: text("brand_story"),
  bestResults: text("best_results"),
  currentOffer: text("current_offer"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const intakeRelations = relations(clientIntake, ({ one }) => ({
  client: one(clients, {
    fields: [clientIntake.clientId],
    references: [clients.id],
  }),
}))

export const adminTasks = pgTable(
  "admin_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    done: boolean("done").notNull().default(false),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tasksClientIdx: index("admin_tasks_client_idx").on(table.clientId),
    tasksDoneIdx: index("admin_tasks_done_idx").on(table.done),
  }),
)

export const tasksRelations = relations(adminTasks, ({ one }) => ({
  client: one(clients, {
    fields: [adminTasks.clientId],
    references: [clients.id],
  }),
}))

export const clientFormationIntake = pgTable("client_formation_intake", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  livretUrl: text("livret_url"),
  livretName: text("livret_name"),
  livretPathname: text("livret_pathname"),
  livretSize: integer("livret_size"),
  livretContentType: text("livret_content_type"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const formationIntakeRelations = relations(
  clientFormationIntake,
  ({ one }) => ({
    client: one(clients, {
      fields: [clientFormationIntake.clientId],
      references: [clients.id],
    }),
  }),
)

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type OnboardingStep = typeof onboardingSteps.$inferSelect
export type NewOnboardingStep = typeof onboardingSteps.$inferInsert
export type ClientFile = typeof clientFiles.$inferSelect
export type NewClientFile = typeof clientFiles.$inferInsert
export type ClientAccess = typeof clientAccess.$inferSelect
export type NewClientAccess = typeof clientAccess.$inferInsert
export type ClientIntake = typeof clientIntake.$inferSelect
export type NewClientIntake = typeof clientIntake.$inferInsert
export type AdminTask = typeof adminTasks.$inferSelect
export type NewAdminTask = typeof adminTasks.$inferInsert
export type ClientFormationIntake = typeof clientFormationIntake.$inferSelect
export type NewClientFormationIntake = typeof clientFormationIntake.$inferInsert

export type ServiceType = "pub" | "formation"
export const SERVICE_TYPES: ServiceType[] = ["pub", "formation"]
export const SERVICE_LABELS: Record<ServiceType, string> = {
  pub: "Publicité",
  formation: "Formation en ligne",
}
