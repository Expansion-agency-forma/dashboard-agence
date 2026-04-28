import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { db } from "@/db/client"
import { invoices, quotes } from "@/db/schema"
import { eq } from "drizzle-orm"
import { completeQuoteAcceptance } from "@/app/q/[token]/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Stripe sends the raw body — we must NOT let Next.js parse it.
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 })
  }

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err)
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "invoice.paid":
        await handleInvoicePaid(event.data.object)
        break
      case "invoice.payment_failed":
      case "invoice.marked_uncollectible":
        await handleInvoiceUncollectible(event.data.object)
        break
      case "invoice.voided":
        await handleInvoiceVoided(event.data.object)
        break
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object)
        break
      // We don't track "finalized" / "sent" since we already record the invoice
      // when issuing it ourselves.
      default:
        // Ignore other events.
        break
    }
  } catch (err) {
    console.error(
      `[stripe/webhook] handler failed for event ${event.type}:`,
      err,
    )
    // Return 200 to avoid Stripe retry storms — we'll surface the error in logs.
    // For genuinely transient errors, switch to a 5xx so Stripe retries.
    return NextResponse.json({ received: true, handlerError: true })
  }

  return NextResponse.json({ received: true })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.id) return
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date()

  await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt,
      stripeHostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      stripeInvoicePdfUrl: invoice.invoice_pdf ?? null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.stripeInvoiceId, invoice.id))
}

async function handleInvoiceUncollectible(invoice: Stripe.Invoice) {
  if (!invoice.id) return
  await db
    .update(invoices)
    .set({
      status: "uncollectible",
      updatedAt: new Date(),
    })
    .where(eq(invoices.stripeInvoiceId, invoice.id))
}

async function handleInvoiceVoided(invoice: Stripe.Invoice) {
  if (!invoice.id) return
  await db
    .update(invoices)
    .set({
      status: "void",
      updatedAt: new Date(),
    })
    .where(eq(invoices.stripeInvoiceId, invoice.id))
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Only react to our quote-deposit checkouts.
  if (session.metadata?.type !== "quote_deposit") return
  if (session.payment_status !== "paid") return

  const quoteId = session.metadata?.quoteId
  if (!quoteId) {
    console.warn("[stripe/webhook] quote_deposit checkout missing quoteId metadata")
    return
  }

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!quote) {
    console.warn("[stripe/webhook] quote not found for deposit:", quoteId)
    return
  }

  if (!quote.depositPaidAt) {
    await db
      .update(quotes)
      .set({
        depositPaidAt: new Date(),
        depositStripeSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quote.id))
  }

  // completeQuoteAcceptance is idempotent — safe even if the return-URL
  // verification already ran first.
  await completeQuoteAcceptance(quote.id)
}
