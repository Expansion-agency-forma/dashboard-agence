"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clients, invoices, monthlyPubRevenue } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"
import { ensureStripeCustomer } from "@/lib/stripe-customer"
import { issueInvoice } from "@/lib/invoices"
import {
  formationPriceCents,
  formatPeriodMonth,
  pubInvoiceCents,
} from "@/lib/pricing"

async function assertAgency() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const role = await getRole()
  if (role !== "agency") throw new Error("Forbidden")
  return userId
}

/**
 * Creates or updates the Stripe Customer for a client based on its current
 * billing details. Returns the customer id.
 */
export async function syncStripeCustomerAction(clientId: string): Promise<{
  customerId: string
}> {
  await assertAgency()

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId))
  if (!client) throw new Error("Client introuvable")

  const customerId = await ensureStripeCustomer(client)

  revalidatePath(`/admin/clients/${clientId}`)
  return { customerId }
}

/**
 * Issues a pub invoice for a validated revenue declaration.
 * Source of truth for the amount: the validated revenue × 20 %.
 */
export async function issuePubInvoiceAction(declarationId: string): Promise<{
  invoiceId: string
  hostedUrl: string | null
}> {
  const userId = await assertAgency()

  const [declaration] = await db
    .select()
    .from(monthlyPubRevenue)
    .where(eq(monthlyPubRevenue.id, declarationId))
  if (!declaration) throw new Error("Déclaration introuvable")
  if (declaration.status !== "validated") {
    throw new Error(
      "Cette déclaration doit être validée avant d'émettre la facture.",
    )
  }
  if (declaration.validatedRevenueCents === null) {
    throw new Error("Aucun CA validé pour cette période.")
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, declaration.clientId))
  if (!client) throw new Error("Client introuvable")

  const amountCents = pubInvoiceCents(declaration.validatedRevenueCents)
  if (amountCents < 100) {
    throw new Error("Montant calculé inférieur à 1 € — vérifie le CA validé.")
  }

  const periodLabel = formatPeriodMonth(declaration.periodMonth)
  const description = `Prestation publicité — ${periodLabel} (20 % du CA déclaré)`

  const invoice = await issueInvoice({
    kind: "pub",
    client,
    revenueDeclarationId: declaration.id,
    lines: [{ amountCents, description }],
    periodMonth: declaration.periodMonth,
    description,
    issuedBy: userId,
  })

  revalidatePath(`/admin/clients/${client.id}`)
  revalidatePath("/dashboard")
  revalidatePath("/admin", "layout")

  return {
    invoiceId: invoice.id,
    hostedUrl: invoice.stripeHostedInvoiceUrl,
  }
}

/**
 * Issues a formation invoice based on the client's stored formationDays.
 */
export async function issueFormationInvoiceAction(
  clientId: string,
): Promise<{ invoiceId: string; hostedUrl: string | null }> {
  const userId = await assertAgency()

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId))
  if (!client) throw new Error("Client introuvable")
  if (!client.services.includes("formation")) {
    throw new Error("Ce client n'a pas la prestation formation.")
  }
  if (!client.formationDays || client.formationDays < 1) {
    throw new Error(
      "Saisis d'abord le nombre de jours de tournage avant d'émettre la facture.",
    )
  }

  const formationCents = formationPriceCents(client.formationDays)
  const formationDescription = `Formation en ligne — ${client.formationDays} jour${
    client.formationDays > 1 ? "s" : ""
  } de tournage`

  const lines = [
    { amountCents: formationCents, description: formationDescription },
  ]
  if (client.formationTravelCents && client.formationTravelCents > 0) {
    lines.push({
      amountCents: client.formationTravelCents,
      description: "Frais de déplacement",
    })
  }

  // Deduct any paid deposit so the formation invoice represents the
  // remaining balance owed.
  const paidDeposits = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.clientId, client.id),
        eq(invoices.serviceType, "deposit"),
        eq(invoices.status, "paid"),
      ),
    )
  const totalDepositCents = paidDeposits.reduce(
    (acc, d) => acc + d.amountCents,
    0,
  )
  if (totalDepositCents > 0) {
    lines.push({
      amountCents: -totalDepositCents,
      description: "Acompte déjà versé (déduit)",
    })
  }

  const invoice = await issueInvoice({
    kind: "formation",
    client,
    lines,
    description: formationDescription,
    issuedBy: userId,
  })

  revalidatePath(`/admin/clients/${client.id}`)
  revalidatePath("/dashboard")
  revalidatePath("/admin", "layout")

  return {
    invoiceId: invoice.id,
    hostedUrl: invoice.stripeHostedInvoiceUrl,
  }
}
