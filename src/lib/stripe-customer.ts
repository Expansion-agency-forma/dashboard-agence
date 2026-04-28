import { db } from "@/db/client"
import { clients, type Client } from "@/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "./stripe"

/**
 * Returns the Stripe Customer id for a client. Creates the customer if it
 * doesn't exist yet (lazy creation), or updates it if billing details
 * have changed since the last sync.
 *
 * Throws if the client doesn't have the minimum billing details required
 * to issue a legal invoice (name, address, SIRET).
 */
export async function ensureStripeCustomer(client: Client): Promise<string> {
  if (
    !client.billingName ||
    !client.billingAddressLine1 ||
    !client.billingPostalCode ||
    !client.billingCity ||
    !client.siret
  ) {
    throw new Error(
      "Coordonnées de facturation incomplètes. Le client doit remplir nom, adresse, CP, ville et SIRET avant qu'on puisse émettre une facture.",
    )
  }

  const customerData: {
    name: string
    email: string
    address: {
      line1: string
      line2?: string
      postal_code: string
      city: string
      country: string
    }
    metadata: Record<string, string>
  } = {
    name: client.billingName,
    email: client.email,
    address: {
      line1: client.billingAddressLine1,
      ...(client.billingAddressLine2 ? { line2: client.billingAddressLine2 } : {}),
      postal_code: client.billingPostalCode,
      city: client.billingCity,
      country: client.billingCountry ?? "FR",
    },
    metadata: {
      clientId: client.id,
      siret: client.siret,
    },
  }

  if (client.stripeCustomerId) {
    // Sync details — Stripe Customer fields can drift if billing details changed.
    try {
      await stripe.customers.update(client.stripeCustomerId, customerData)
      return client.stripeCustomerId
    } catch (err) {
      // If the customer was deleted on Stripe (rare), fall through to create.
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "resource_missing"
      ) {
        // continue to create
      } else {
        throw err
      }
    }
  }

  const created = await stripe.customers.create(customerData)
  await db
    .update(clients)
    .set({ stripeCustomerId: created.id, updatedAt: new Date() })
    .where(eq(clients.id, client.id))
  return created.id
}
