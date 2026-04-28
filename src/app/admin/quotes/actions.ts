"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { quotes } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"
import { generateQuoteToken } from "@/lib/quote-token"

const QUOTE_DURATION_DAYS = 7

async function assertAgency() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const role = await getRole()
  if (role !== "agency") throw new Error("Forbidden")
  return userId
}

const createQuoteSchema = z.object({
  prospectName: z.string().trim().min(1).max(250),
  prospectEmail: z.string().trim().email().max(250),
  prospectCompany: z.string().trim().max(250).optional().nullable(),
  prospectDomain: z.string().trim().max(250).optional().nullable(),
  prospectSiret: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "Le SIRET doit comporter 14 chiffres")
    .optional()
    .nullable()
    .or(z.literal("")),
  services: z
    .array(z.enum(["pub", "formation"]))
    .min(1, "Sélectionne au moins une prestation"),
  pubExpectedMonthlyRevenueCents: z
    .number()
    .int()
    .min(0)
    .max(1_000_000_000)
    .optional()
    .nullable(),
  formationDays: z.number().int().min(1).max(365).optional().nullable(),
  formationTravelCents: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .optional()
    .nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(90).default(QUOTE_DURATION_DAYS),
})

export type CreateQuoteInput = z.input<typeof createQuoteSchema>

export async function createQuoteAction(input: CreateQuoteInput) {
  const userId = await assertAgency()
  const parsed = createQuoteSchema.parse(input)

  // Sanity: formation fields only make sense if "formation" is in services.
  const wantsFormation = parsed.services.includes("formation")
  const wantsPub = parsed.services.includes("pub")

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + parsed.expiresInDays)

  const [row] = await db
    .insert(quotes)
    .values({
      publicToken: generateQuoteToken(),
      prospectName: parsed.prospectName,
      prospectEmail: parsed.prospectEmail.toLowerCase(),
      prospectCompany: parsed.prospectCompany?.trim() || null,
      prospectDomain: parsed.prospectDomain?.trim() || null,
      prospectSiret: parsed.prospectSiret?.trim() || null,
      services: parsed.services,
      pubExpectedMonthlyRevenueCents: wantsPub
        ? parsed.pubExpectedMonthlyRevenueCents ?? null
        : null,
      formationDays: wantsFormation ? parsed.formationDays ?? null : null,
      formationTravelCents: wantsFormation
        ? parsed.formationTravelCents ?? null
        : null,
      notes: parsed.notes?.trim() || null,
      status: "draft",
      expiresAt,
      createdBy: userId,
    })
    .returning({ id: quotes.id })

  revalidatePath("/admin/quotes")
  redirect(`/admin/quotes/${row.id}`)
}

export async function markQuoteSentAction(quoteId: string) {
  await assertAgency()

  const [row] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!row) throw new Error("Devis introuvable")
  if (row.status !== "draft") {
    throw new Error("Seul un brouillon peut être marqué comme envoyé.")
  }

  await db
    .update(quotes)
    .set({
      status: "sent",
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId))

  revalidatePath("/admin/quotes")
  revalidatePath(`/admin/quotes/${quoteId}`)
}

export async function deleteQuoteAction(quoteId: string) {
  await assertAgency()

  const [row] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!row) return
  if (row.status === "accepted") {
    throw new Error("Impossible de supprimer un devis accepté.")
  }

  await db.delete(quotes).where(eq(quotes.id, quoteId))

  revalidatePath("/admin/quotes")
  redirect("/admin/quotes")
}

export async function setQuoteStatusAction(
  quoteId: string,
  status: "rejected" | "expired",
) {
  await assertAgency()

  const [row] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!row) throw new Error("Devis introuvable")
  if (row.status === "accepted") {
    throw new Error("Devis déjà accepté.")
  }

  const now = new Date()
  await db
    .update(quotes)
    .set({
      status,
      rejectedAt: status === "rejected" ? now : row.rejectedAt,
      updatedAt: now,
    })
    .where(eq(quotes.id, quoteId))

  revalidatePath("/admin/quotes")
  revalidatePath(`/admin/quotes/${quoteId}`)
}
