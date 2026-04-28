import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  integer,
  boolean,
  uniqueIndex,
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
    // Activity / industry — carried over from the quote at conversion.
    domain: text("domain"),
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
    // Client's choice during onboarding: "invite" (they invite us on their
    // existing ad account) or "create" (they want us to create it)
    adAccountPreference: text("ad_account_preference"),
    adAccountInviteConfirmedAt: timestamp("ad_account_invite_confirmed_at", {
      withTimezone: true,
    }),
    // Billing details — used to issue monthly invoices via Stripe.
    billingName: text("billing_name"),
    billingAddressLine1: text("billing_address_line1"),
    billingAddressLine2: text("billing_address_line2"),
    billingPostalCode: text("billing_postal_code"),
    billingCity: text("billing_city"),
    billingCountry: text("billing_country").default("FR"),
    siret: text("siret"),
    // Formation pricing inputs — number of shooting days (1+).
    // Final price: see lib/pricing#formationPriceCents.
    formationDays: integer("formation_days"),
    // Optional travel fee billed on top of the formation invoice (in cents).
    // The admin enters the share they want billed to the client (e.g. 50 % of trip cost).
    formationTravelCents: integer("formation_travel_cents"),
    // Stripe Customer id (one per client). Created lazily once billing info is filled.
    stripeCustomerId: text("stripe_customer_id").unique(),
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

export const revenueDeclarationStatus = pgEnum("revenue_declaration_status", [
  "pending", // no declaration yet for this month
  "declared", // client has declared a revenue, waiting for admin
  "validated", // admin has validated, ready to invoice
  "invoiced", // invoice has been issued (Phase 3)
])

export const monthlyPubRevenue = pgTable(
  "monthly_pub_revenue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // YYYY-MM, e.g. "2026-04". Stored as text to avoid timezone games.
    periodMonth: text("period_month").notNull(),
    declaredRevenueCents: integer("declared_revenue_cents"),
    declaredAt: timestamp("declared_at", { withTimezone: true }),
    validatedRevenueCents: integer("validated_revenue_cents"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    validatedBy: text("validated_by"), // Clerk user id of the agency member who validated
    notes: text("notes"),
    status: revenueDeclarationStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("revenue_client_period_idx").on(
      table.clientId,
      table.periodMonth,
    ),
    index("revenue_status_idx").on(table.status),
  ],
)

export const monthlyPubRevenueRelations = relations(
  monthlyPubRevenue,
  ({ one }) => ({
    client: one(clients, {
      fields: [monthlyPubRevenue.clientId],
      references: [clients.id],
    }),
  }),
)

export const quoteStatus = pgEnum("quote_status", [
  "draft", // not yet sent
  "sent", // shared with prospect, awaiting their decision
  "accepted", // prospect accepted — client account created
  "rejected", // prospect declined
  "expired", // past expiresAt without action
])

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // URL-safe random token used in /q/<token> public link
    publicToken: text("public_token").notNull().unique(),

    // Prospect info — captured at quote creation, before any account exists.
    prospectName: text("prospect_name").notNull(),
    prospectEmail: text("prospect_email").notNull(),
    prospectCompany: text("prospect_company"),
    // Activity / industry of the prospect (e.g. "Beauté", "Coaching B2B").
    prospectDomain: text("prospect_domain"),
    // 14-digit French SIRET, captured at quote stage so it's already on the PDF.
    prospectSiret: text("prospect_siret"),

    // Services proposed in the quote.
    services: text("services").array().notNull(),

    // Pub: optional monthly revenue estimate to compute a sample monthly fee.
    pubExpectedMonthlyRevenueCents: integer("pub_expected_monthly_revenue_cents"),

    // Formation pricing inputs (mirror clients table).
    formationDays: integer("formation_days"),
    formationTravelCents: integer("formation_travel_cents"),

    // Optional free-form notes shown on the quote (e.g. scope details).
    notes: text("notes"),

    status: quoteStatus("status").notNull().default("draft"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    // Set when the prospect accepts and a client row is created.
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    // Deposit (10 % of formation total). 0 / null when no formation in scope.
    depositAmountCents: integer("deposit_amount_cents"),
    depositStripeSessionId: text("deposit_stripe_session_id").unique(),
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),

    // Electronic signature (eIDAS Simple Electronic Signature).
    // Captured at the moment the prospect clicks "Accept" (before deposit
    // checkout for formation quotes, simultaneous with acceptance for pub).
    signatureName: text("signature_name"), // full name typed by the prospect
    signatureIp: text("signature_ip"),
    signatureUserAgent: text("signature_user_agent"),
    signedAt: timestamp("signed_at", { withTimezone: true }),

    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("quotes_status_idx").on(table.status),
    index("quotes_email_idx").on(table.prospectEmail),
    index("quotes_token_idx").on(table.publicToken),
  ],
)

export const quotesRelations = relations(quotes, ({ one }) => ({
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
}))

// Mirrors Stripe's invoice statuses we care about.
export const invoiceStatus = pgEnum("invoice_status", [
  "open", // finalized, sent, awaiting payment
  "paid",
  "uncollectible",
  "void",
])

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    serviceType: text("service_type").notNull(), // "pub" | "formation"
    periodMonth: text("period_month"), // YYYY-MM, only for pub
    amountCents: integer("amount_cents").notNull(),
    status: invoiceStatus("status").notNull().default("open"),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    stripeInvoiceNumber: text("stripe_invoice_number"), // legal invoice number
    stripeHostedInvoiceUrl: text("stripe_hosted_invoice_url"),
    stripeInvoicePdfUrl: text("stripe_invoice_pdf_url"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    issuedBy: text("issued_by").notNull(), // Clerk user id of the agency member who issued
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invoices_client_idx").on(table.clientId),
    index("invoices_period_idx").on(table.clientId, table.periodMonth),
    index("invoices_status_idx").on(table.status),
  ],
)

export const invoicesRelations = relations(invoices, ({ one }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
}))

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
export type MonthlyPubRevenue = typeof monthlyPubRevenue.$inferSelect
export type NewMonthlyPubRevenue = typeof monthlyPubRevenue.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
export type QuoteStatus = (typeof quoteStatus.enumValues)[number]

export type ServiceType = "pub" | "formation"
export const SERVICE_TYPES: ServiceType[] = ["pub", "formation"]
export const SERVICE_LABELS: Record<ServiceType, string> = {
  pub: "Publicité",
  formation: "Formation en ligne",
}
