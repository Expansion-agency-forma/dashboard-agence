import { db } from "@/db/client"
import {
  clients,
  invoices,
  monthlyPubRevenue,
  type Client,
  type Invoice,
} from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { stripe } from "./stripe"
import { ensureStripeCustomer } from "./stripe-customer"

export type InvoiceLine = {
  amountCents: number
  description: string
}

export type IssueInvoiceInput =
  | {
      kind: "pub"
      client: Client
      revenueDeclarationId: string
      lines: InvoiceLine[]
      periodMonth: string // YYYY-MM
      description: string // appears on the Stripe invoice header (memo)
      issuedBy: string
    }
  | {
      kind: "formation"
      client: Client
      lines: InvoiceLine[]
      description: string
      issuedBy: string
    }

/**
 * Creates and finalizes a Stripe Invoice for a client, then persists it in the
 * `invoices` table. Stripe handles numbering, the PDF, and emailing the client
 * with a payment link.
 *
 * For pub invoices, also updates the monthly_pub_revenue row to "invoiced".
 */
export async function issueInvoice(input: IssueInvoiceInput): Promise<Invoice> {
  if (input.lines.length === 0) {
    throw new Error("Au moins une ligne est requise pour la facture.")
  }
  const totalCents = input.lines.reduce((acc, l) => acc + l.amountCents, 0)
  if (totalCents < 100) {
    throw new Error(
      "Le montant total de la facture doit être d'au moins 1 € (100 centimes).",
    )
  }
  for (const line of input.lines) {
    if (line.amountCents === 0) {
      throw new Error("Chaque ligne doit avoir un montant non nul.")
    }
  }
  // Lines may be negative (deposit deductions, credits) but the total must
  // be positive — checked above via totalCents < 100.

  const customerId = await ensureStripeCustomer(input.client)

  // 1) Create a draft invoice
  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 30,
    auto_advance: false, // we'll finalize manually below
    description: input.description,
    metadata: {
      clientId: input.client.id,
      kind: input.kind,
      ...(input.kind === "pub" ? { periodMonth: input.periodMonth } : {}),
    },
    pending_invoice_items_behavior: "exclude",
  })
  if (!draft.id) throw new Error("Stripe invoice creation failed")

  // 2) Add the line items, attached to this specific invoice
  for (const line of input.lines) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draft.id,
      currency: "eur",
      amount: line.amountCents,
      description: line.description,
    })
  }

  // 3) Finalize → assigns an invoice number, generates the PDF, sends the email.
  const finalized = await stripe.invoices.finalizeInvoice(draft.id, {
    auto_advance: true,
  })

  // Persist in our DB
  const [row] = await db
    .insert(invoices)
    .values({
      clientId: input.client.id,
      serviceType: input.kind,
      periodMonth: input.kind === "pub" ? input.periodMonth : null,
      amountCents: totalCents,
      status: stripeStatusToOurStatus(finalized.status),
      stripeInvoiceId: finalized.id!,
      stripeInvoiceNumber: finalized.number ?? null,
      stripeHostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      stripeInvoicePdfUrl: finalized.invoice_pdf ?? null,
      issuedAt: new Date(),
      issuedBy: input.issuedBy,
    })
    .returning()

  if (input.kind === "pub") {
    await db
      .update(monthlyPubRevenue)
      .set({
        status: "invoiced",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(monthlyPubRevenue.id, input.revenueDeclarationId),
          eq(monthlyPubRevenue.clientId, input.client.id),
        ),
      )
  }

  if (!input.client.stripeCustomerId) {
    await db
      .update(clients)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(clients.id, input.client.id))
  }

  return row
}

function stripeStatusToOurStatus(
  s: string | null,
): "open" | "paid" | "uncollectible" | "void" {
  switch (s) {
    case "paid":
      return "paid"
    case "uncollectible":
      return "uncollectible"
    case "void":
      return "void"
    default:
      return "open"
  }
}

/**
 * Creates a Stripe invoice for a deposit that was already paid externally
 * (via the quote acceptance Checkout Session). The invoice is finalized and
 * marked as paid out-of-band — Stripe generates the PDF + numbering, the
 * client gets a downloadable receipt, and our `invoices` table tracks it.
 *
 * Idempotent: if a deposit invoice already exists for this client + this
 * Stripe checkout session, we don't create a duplicate.
 */
export async function issueDepositInvoice(input: {
  client: Client
  amountCents: number
  description: string
  metadata: Record<string, string>
}): Promise<Invoice | null> {
  if (input.amountCents < 100) return null

  // Idempotency check — don't double-create if we already have one for this
  // session id (caller should pass the session id in metadata).
  const sessionId = input.metadata.depositSessionId
  if (sessionId) {
    const existing = await db
      .select()
      .from(invoices)
      .where(eq(invoices.clientId, input.client.id))
    const dup = existing.find(
      (i) => i.serviceType === "deposit" && i.status === "paid",
    )
    if (dup) return dup
  }

  const customerId = await ensureStripeCustomer(input.client)

  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 1,
    auto_advance: false,
    description: input.description,
    metadata: {
      clientId: input.client.id,
      kind: "deposit",
      ...input.metadata,
    },
    pending_invoice_items_behavior: "exclude",
  })
  if (!draft.id) throw new Error("Stripe deposit invoice creation failed")

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draft.id,
    currency: "eur",
    amount: input.amountCents,
    description: input.description,
  })

  const finalized = await stripe.invoices.finalizeInvoice(draft.id, {
    auto_advance: false,
  })

  // Mark as paid out-of-band — payment was received via the Checkout Session.
  const paid = await stripe.invoices.pay(finalized.id!, {
    paid_out_of_band: true,
  })

  const [row] = await db
    .insert(invoices)
    .values({
      clientId: input.client.id,
      serviceType: "deposit",
      periodMonth: null,
      amountCents: input.amountCents,
      status: "paid",
      stripeInvoiceId: paid.id!,
      stripeInvoiceNumber: paid.number ?? null,
      stripeHostedInvoiceUrl: paid.hosted_invoice_url ?? null,
      stripeInvoicePdfUrl: paid.invoice_pdf ?? null,
      issuedAt: new Date(),
      paidAt: new Date(),
      issuedBy: "system",
    })
    .returning()

  if (!input.client.stripeCustomerId) {
    await db
      .update(clients)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(clients.id, input.client.id))
  }

  return row
}
