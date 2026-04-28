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
    if (line.amountCents <= 0) {
      throw new Error("Chaque ligne doit avoir un montant strictement positif.")
    }
  }

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
