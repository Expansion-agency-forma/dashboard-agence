"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { clerkClient } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clients, quotes, type Quote } from "@/db/schema"
import { eq } from "drizzle-orm"
import { seedDefaultSteps } from "@/lib/onboarding"
import { stripe } from "@/lib/stripe"
import { computeQuoteDepositCents, formatEuros } from "@/lib/pricing"
import { getClientIp, getUserAgent } from "@/lib/request-meta"

const tokenSchema = z.string().min(20).max(64)
const signatureNameSchema = z.string().trim().min(2).max(250)

/**
 * Persists the electronic signature evidence on the quote — full name typed,
 * IP, user agent, timestamp. Called from accept + checkout actions before
 * the irreversible step (DB acceptance or Stripe redirect).
 */
async function persistSignature(quoteId: string, name: string): Promise<void> {
  const [ip, ua] = await Promise.all([getClientIp(), getUserAgent()])
  await db
    .update(quotes)
    .set({
      signatureName: name,
      signatureIp: ip,
      signatureUserAgent: ua,
      signedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId))
}

export type AcceptResult =
  | { ok: true; clientCreated: boolean }
  | { ok: false; error: string }

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

/** Auto-mark a quote as "expired" if past expiresAt while still pending. */
export async function expireQuoteIfNeeded(quoteId: string): Promise<void> {
  await db
    .update(quotes)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
}

function validatePending(
  quote: Quote,
): { ok: true } | { ok: false; error: string } {
  if (quote.status === "accepted") {
    return { ok: false, error: "Ce devis a déjà été accepté." }
  }
  if (quote.status === "rejected") {
    return { ok: false, error: "Ce devis a déjà été refusé." }
  }
  if (quote.status === "expired" || quote.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Ce devis a expiré." }
  }
  if (quote.status === "draft") {
    return {
      ok: false,
      error: "Ce devis n'a pas encore été partagé par l'agence.",
    }
  }
  return { ok: true }
}

/**
 * Idempotent: creates the client + sends the Clerk invitation + marks the
 * quote as accepted. Safe to call multiple times — subsequent calls return
 * early. Used both by the public direct-accept path (no deposit) and by the
 * Stripe webhook / return URL after deposit payment.
 */
export async function completeQuoteAcceptance(
  quoteId: string,
): Promise<AcceptResult> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!quote) return { ok: false, error: "Devis introuvable." }

  if (quote.status === "accepted") {
    return { ok: true, clientCreated: false }
  }

  // Find or create the client.
  const email = quote.prospectEmail.toLowerCase()
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))

  let clientId: string
  let clientCreated = false

  if (existing) {
    clientId = existing.id
    await db
      .update(clients)
      .set({
        services:
          existing.services.length > 0 ? existing.services : quote.services,
        formationDays: existing.formationDays ?? quote.formationDays,
        formationTravelCents:
          existing.formationTravelCents ?? quote.formationTravelCents,
        company: existing.company ?? quote.prospectCompany,
        domain: existing.domain ?? quote.prospectDomain,
        siret: existing.siret ?? quote.prospectSiret,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, existing.id))
  } else {
    try {
      const [row] = await db
        .insert(clients)
        .values({
          name: quote.prospectName,
          email,
          company: quote.prospectCompany,
          domain: quote.prospectDomain,
          siret: quote.prospectSiret,
          services: quote.services,
          formationDays: quote.formationDays,
          formationTravelCents: quote.formationTravelCents,
          createdBy: quote.createdBy,
        })
        .returning({ id: clients.id })
      clientId = row.id
      clientCreated = true
      await seedDefaultSteps(clientId)
    } catch (err) {
      console.error("[completeQuoteAcceptance] client creation failed:", err)
      return {
        ok: false,
        error:
          "Impossible de créer votre espace. Contactez l'agence pour qu'elle finalise manuellement.",
      }
    }

    // Send Clerk invitation (fire-and-forget).
    try {
      const client = await clerkClient()
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000")
      const invitation = await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${origin}/sign-up`,
        publicMetadata: { role: "client", clientId },
        notify: true,
        ignoreExisting: true,
      })
      await db
        .update(clients)
        .set({
          invitationId: invitation.id,
          invitationUrl: invitation.url ?? null,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, clientId))
    } catch (err) {
      console.error("[completeQuoteAcceptance] Clerk invitation failed:", err)
    }
  }

  await db
    .update(quotes)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      clientId,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quote.id))

  revalidatePath(`/q/${quote.publicToken}`)
  revalidatePath(`/admin/quotes/${quote.id}`)
  revalidatePath("/admin/quotes")
  revalidatePath("/admin/clients")

  return { ok: true, clientCreated }
}

/** Direct accept — only valid when the quote does NOT require a deposit
 *  (i.e. no formation in scope). Otherwise, the prospect must use the
 *  checkout flow via createDepositCheckoutAction. */
export async function acceptQuoteAction(
  token: string,
  signatureName: string,
): Promise<AcceptResult> {
  let parsedToken: string
  let parsedName: string
  try {
    parsedToken = tokenSchema.parse(token)
    parsedName = signatureNameSchema.parse(signatureName)
  } catch {
    return { ok: false, error: "Signature ou lien invalide." }
  }

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, parsedToken))
  if (!quote) return { ok: false, error: "Devis introuvable." }

  const guard = validatePending(quote)
  if (!guard.ok) {
    if (quote.status === "accepted") {
      return { ok: true, clientCreated: false } // idempotent
    }
    return guard
  }

  const depositCents = computeQuoteDepositCents(quote)
  if (depositCents > 0) {
    return {
      ok: false,
      error:
        "Ce devis nécessite le paiement d'un acompte — utilise le bouton de paiement.",
    }
  }

  await persistSignature(quote.id, parsedName)
  return completeQuoteAcceptance(quote.id)
}

export async function rejectQuoteAction(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  let parsedToken: string
  try {
    parsedToken = tokenSchema.parse(token)
  } catch {
    return { ok: false, error: "Lien invalide." }
  }

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, parsedToken))
  if (!quote) return { ok: false, error: "Devis introuvable." }

  if (quote.status === "accepted") {
    return { ok: false, error: "Ce devis a déjà été accepté." }
  }
  if (quote.status === "rejected") return { ok: true } // idempotent

  await db
    .update(quotes)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quote.id))

  revalidatePath(`/q/${parsedToken}`)
  revalidatePath(`/admin/quotes/${quote.id}`)
  revalidatePath("/admin/quotes")

  return { ok: true }
}

/**
 * Creates a Stripe Checkout Session for the deposit and returns the URL the
 * prospect should be redirected to. The session id is persisted on the quote
 * so the webhook + return URL can match payment events back to the quote.
 */
export async function createDepositCheckoutAction(
  token: string,
  signatureName: string,
): Promise<CheckoutResult> {
  let parsedToken: string
  let parsedName: string
  try {
    parsedToken = tokenSchema.parse(token)
    parsedName = signatureNameSchema.parse(signatureName)
  } catch {
    return { ok: false, error: "Signature ou lien invalide." }
  }

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, parsedToken))
  if (!quote) return { ok: false, error: "Devis introuvable." }

  const guard = validatePending(quote)
  if (!guard.ok) return guard

  const depositCents = computeQuoteDepositCents(quote)
  if (depositCents <= 0) {
    return {
      ok: false,
      error: "Ce devis ne nécessite pas d'acompte — utilise le bouton d'acceptation directe.",
    }
  }

  // Capture the signature evidence BEFORE redirecting to Stripe — the prospect
  // has agreed to the terms even if they later abandon the payment.
  await persistSignature(quote.id, parsedName)

  // Build the success/cancel URLs from the request host so dev + prod work.
  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "http"
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const baseUrl = `${origin}/q/${quote.publicToken}`

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: quote.prospectEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: depositCents,
          product_data: {
            name: `Acompte 10 % — Formation${
              quote.prospectCompany ? ` (${quote.prospectCompany})` : ""
            }`,
            description: `Acompte de ${formatEuros(
              depositCents,
            )} pour bloquer la date de tournage. Déduit de la facture finale.`,
          },
        },
      },
    ],
    success_url: `${baseUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}?cancelled=true`,
    metadata: {
      quoteId: quote.id,
      quoteToken: quote.publicToken,
      type: "quote_deposit",
    },
    payment_intent_data: {
      metadata: {
        quoteId: quote.id,
        type: "quote_deposit",
      },
    },
  })
  if (!session.url) {
    return { ok: false, error: "Stripe n'a pas renvoyé d'URL de paiement." }
  }

  await db
    .update(quotes)
    .set({
      depositAmountCents: depositCents,
      depositStripeSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quote.id))

  return { ok: true, url: session.url }
}

/**
 * Called from the public page on return from Stripe (with ?session_id=…).
 * Verifies the session is paid via the Stripe API, marks deposit paid, and
 * triggers the acceptance. Idempotent.
 */
export async function verifyDepositSessionAction(
  token: string,
  sessionId: string,
): Promise<AcceptResult> {
  let parsedToken: string
  try {
    parsedToken = tokenSchema.parse(token)
  } catch {
    return { ok: false, error: "Lien invalide." }
  }

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, parsedToken))
  if (!quote) return { ok: false, error: "Devis introuvable." }

  // Make sure the session id matches what we stored to prevent tampering.
  if (
    quote.depositStripeSessionId &&
    quote.depositStripeSessionId !== sessionId
  ) {
    return { ok: false, error: "Session de paiement non reconnue." }
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    console.error("[verifyDepositSession] retrieve failed:", err)
    return { ok: false, error: "Impossible de vérifier le paiement." }
  }

  if (session.payment_status !== "paid") {
    return { ok: false, error: "Le paiement n'est pas encore confirmé." }
  }

  if (!quote.depositPaidAt) {
    await db
      .update(quotes)
      .set({
        depositPaidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quote.id))
  }

  return completeQuoteAcceptance(quote.id)
}
