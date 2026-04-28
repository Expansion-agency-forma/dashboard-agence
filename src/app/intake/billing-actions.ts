"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const billingIntakeSchema = z.object({
  clientId: z.string().uuid(),
  billingName: z.string().trim().min(1).max(250),
  billingAddressLine1: z.string().trim().min(1).max(250),
  billingAddressLine2: z.string().trim().max(250).optional().nullable(),
  billingPostalCode: z.string().trim().min(2).max(20),
  billingCity: z.string().trim().min(1).max(120),
  billingCountry: z.string().trim().length(2).optional().nullable(),
  siret: z.string().trim().regex(/^\d{14}$/, "Le SIRET doit comporter 14 chiffres"),
})

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

export async function saveBillingIntakeAction(input: {
  clientId: string
  billingName: string
  billingAddressLine1: string
  billingAddressLine2?: string | null
  billingPostalCode: string
  billingCity: string
  billingCountry?: string | null
  siret: string
}) {
  const parsed = billingIntakeSchema.parse(input)
  await assertCanEditClient(parsed.clientId)

  await db
    .update(clients)
    .set({
      billingName: parsed.billingName,
      billingAddressLine1: parsed.billingAddressLine1,
      billingAddressLine2: parsed.billingAddressLine2?.trim() || null,
      billingPostalCode: parsed.billingPostalCode,
      billingCity: parsed.billingCity,
      billingCountry: parsed.billingCountry?.trim() || "FR",
      siret: parsed.siret,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, parsed.clientId))

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${parsed.clientId}`)
}
