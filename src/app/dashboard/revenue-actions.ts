"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clients, monthlyPubRevenue } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

async function assertCanEditClient(clientId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const role = await getRole()
  if (role === "agency") return userId

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress.toLowerCase()
  if (!email) throw new Error("Unauthorized")
  const [row] = await db.select().from(clients).where(eq(clients.id, clientId))
  if (!row || row.email !== email) throw new Error("Accès interdit")
  return userId
}

const declareSchema = z.object({
  clientId: z.string().uuid(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Période invalide (YYYY-MM)"),
  revenueCents: z.number().int().min(0).max(1_000_000_000), // < 10 M€ sanity cap
})

export async function declarePubRevenueAction(input: {
  clientId: string
  periodMonth: string
  revenueCents: number
}) {
  const parsed = declareSchema.parse(input)
  await assertCanEditClient(parsed.clientId)

  // Verify the client actually has the "pub" service.
  const [client] = await db
    .select({ services: clients.services })
    .from(clients)
    .where(eq(clients.id, parsed.clientId))
  if (!client) throw new Error("Client introuvable")
  if (!client.services.includes("pub")) {
    throw new Error("Ce client n'a pas la prestation pub")
  }

  // Reject if a row exists and is already validated/invoiced (admin must unvalidate first).
  const [existing] = await db
    .select()
    .from(monthlyPubRevenue)
    .where(
      and(
        eq(monthlyPubRevenue.clientId, parsed.clientId),
        eq(monthlyPubRevenue.periodMonth, parsed.periodMonth),
      ),
    )
  if (existing && (existing.status === "validated" || existing.status === "invoiced")) {
    throw new Error(
      "Ce mois est déjà validé. Contactez votre gestionnaire pour le rouvrir.",
    )
  }

  const now = new Date()
  await db
    .insert(monthlyPubRevenue)
    .values({
      clientId: parsed.clientId,
      periodMonth: parsed.periodMonth,
      declaredRevenueCents: parsed.revenueCents,
      declaredAt: now,
      status: "declared",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [monthlyPubRevenue.clientId, monthlyPubRevenue.periodMonth],
      set: {
        declaredRevenueCents: parsed.revenueCents,
        declaredAt: now,
        status: "declared",
        updatedAt: now,
      },
    })

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${parsed.clientId}`)
  revalidatePath("/admin", "layout")
}
