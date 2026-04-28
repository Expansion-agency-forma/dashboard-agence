"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { adminTasks, monthlyPubRevenue } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

async function assertAgency() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const role = await getRole()
  if (role !== "agency") throw new Error("Forbidden")
  return userId
}

const createTaskSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(250),
  description: z.string().max(2000).optional(),
})

export async function createTaskAction(input: {
  clientId: string
  title: string
  description?: string
}) {
  const userId = await assertAgency()
  const parsed = createTaskSchema.parse(input)
  const description = parsed.description?.trim() || null

  await db.insert(adminTasks).values({
    clientId: parsed.clientId,
    title: parsed.title.trim(),
    description,
    createdBy: userId,
  })

  revalidatePath(`/admin/clients/${parsed.clientId}`)
  revalidatePath("/admin/tasks")
  revalidatePath("/admin", "layout")
}

export async function toggleTaskAction(taskId: string, done: boolean) {
  await assertAgency()

  const [task] = await db.select().from(adminTasks).where(eq(adminTasks.id, taskId))
  if (!task) throw new Error("Tâche introuvable")

  await db
    .update(adminTasks)
    .set({
      done,
      completedAt: done ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(adminTasks.id, taskId))

  revalidatePath(`/admin/clients/${task.clientId}`)
  revalidatePath("/admin/tasks")
  revalidatePath("/admin", "layout")
}

export async function deleteTaskAction(taskId: string) {
  await assertAgency()

  const [task] = await db.select().from(adminTasks).where(eq(adminTasks.id, taskId))
  if (!task) return

  await db
    .delete(adminTasks)
    .where(and(eq(adminTasks.id, taskId), eq(adminTasks.clientId, task.clientId)))

  revalidatePath(`/admin/clients/${task.clientId}`)
  revalidatePath("/admin/tasks")
  revalidatePath("/admin", "layout")
}

export async function updateServicesAction(
  clientId: string,
  services: ("pub" | "formation")[],
) {
  await assertAgency()
  if (services.length === 0) throw new Error("Au moins une prestation requise")

  const { clients } = await import("@/db/schema")
  await db
    .update(clients)
    .set({ services, updatedAt: new Date() })
    .where(eq(clients.id, clientId))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/clients")
}

export async function updateAdAccountAction(
  clientId: string,
  input: {
    hasAccess: boolean
    name?: string | null
    cardAlreadyOnAccount?: boolean
  },
) {
  await assertAgency()
  const { clients } = await import("@/db/schema")

  if (input.hasAccess) {
    const name = (input.name ?? "").trim()
    if (!name) throw new Error("Nom du compte publicitaire requis")
    const [existing] = await db
      .select({
        adAccountCreatedAt: clients.adAccountCreatedAt,
        adAccountCardConfirmedAt: clients.adAccountCardConfirmedAt,
      })
      .from(clients)
      .where(eq(clients.id, clientId))

    let cardConfirmedAt: Date | null
    if (input.cardAlreadyOnAccount === true) {
      // Admin confirms card is already on the account — skip the client popup.
      cardConfirmedAt = existing?.adAccountCardConfirmedAt ?? new Date()
    } else if (input.cardAlreadyOnAccount === false) {
      // Admin says no — client will get the Loom popup to add their card.
      cardConfirmedAt = null
    } else {
      cardConfirmedAt = existing?.adAccountCardConfirmedAt ?? null
    }

    await db
      .update(clients)
      .set({
        adAccountCreatedAt: existing?.adAccountCreatedAt ?? new Date(),
        adAccountName: name,
        adAccountCardConfirmedAt: cardConfirmedAt,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
  } else {
    // Unchecked: clear all ad-account access state (keep the client's preference)
    await db
      .update(clients)
      .set({
        adAccountCreatedAt: null,
        adAccountName: null,
        adAccountCardConfirmedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
  }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/clients")
  revalidatePath("/dashboard")
}

export async function confirmCardAddedAction(clientId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const role = await getRole()
  const { clients } = await import("@/db/schema")

  if (role === "client") {
    const { currentUser } = await import("@clerk/nextjs/server")
    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress.toLowerCase()
    if (!email) throw new Error("Unauthorized")
    const [row] = await db
      .select({ email: clients.email })
      .from(clients)
      .where(eq(clients.id, clientId))
    if (!row || row.email !== email) throw new Error("Accès interdit")
  }

  await db
    .update(clients)
    .set({
      adAccountCardConfirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/dashboard")
}

const billingSchema = z.object({
  billingName: z.string().trim().max(250).optional().nullable(),
  billingAddressLine1: z.string().trim().max(250).optional().nullable(),
  billingAddressLine2: z.string().trim().max(250).optional().nullable(),
  billingPostalCode: z.string().trim().max(20).optional().nullable(),
  billingCity: z.string().trim().max(120).optional().nullable(),
  billingCountry: z.string().trim().length(2).optional().nullable(),
  siret: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "Le SIRET doit comporter 14 chiffres")
    .optional()
    .nullable()
    .or(z.literal("")),
})

export async function updateBillingAction(
  clientId: string,
  input: {
    billingName?: string | null
    billingAddressLine1?: string | null
    billingAddressLine2?: string | null
    billingPostalCode?: string | null
    billingCity?: string | null
    billingCountry?: string | null
    siret?: string | null
  },
) {
  await assertAgency()
  const parsed = billingSchema.parse(input)
  const { clients } = await import("@/db/schema")

  const norm = (v: string | null | undefined) =>
    v === undefined ? undefined : v && v.length > 0 ? v : null

  await db
    .update(clients)
    .set({
      billingName: norm(parsed.billingName),
      billingAddressLine1: norm(parsed.billingAddressLine1),
      billingAddressLine2: norm(parsed.billingAddressLine2),
      billingPostalCode: norm(parsed.billingPostalCode),
      billingCity: norm(parsed.billingCity),
      billingCountry: norm(parsed.billingCountry) ?? "FR",
      siret: norm(parsed.siret),
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/dashboard")
}

export async function setFormationDaysAction(
  clientId: string,
  days: number | null,
) {
  await assertAgency()
  const { clients } = await import("@/db/schema")

  let value: number | null = null
  if (days !== null) {
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new Error("Nombre de jours invalide (1 à 365)")
    }
    value = days
  }

  await db
    .update(clients)
    .set({ formationDays: value, updatedAt: new Date() })
    .where(eq(clients.id, clientId))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/dashboard")
}

export async function setFormationTravelAction(
  clientId: string,
  cents: number | null,
) {
  await assertAgency()
  const { clients } = await import("@/db/schema")

  let value: number | null = null
  if (cents !== null) {
    if (!Number.isInteger(cents) || cents < 0 || cents > 10_000_000) {
      throw new Error("Montant de déplacement invalide (0 à 100 000 €)")
    }
    value = cents > 0 ? cents : null
  }

  await db
    .update(clients)
    .set({ formationTravelCents: value, updatedAt: new Date() })
    .where(eq(clients.id, clientId))

  revalidatePath(`/admin/clients/${clientId}`)
}

const validateRevenueSchema = z.object({
  declarationId: z.string().uuid(),
  validatedRevenueCents: z.number().int().min(0),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export async function validatePubRevenueAction(input: {
  declarationId: string
  validatedRevenueCents: number
  notes?: string | null
}) {
  const userId = await assertAgency()
  const parsed = validateRevenueSchema.parse(input)

  const [row] = await db
    .select()
    .from(monthlyPubRevenue)
    .where(eq(monthlyPubRevenue.id, parsed.declarationId))
  if (!row) throw new Error("Déclaration introuvable")
  if (row.status === "invoiced") throw new Error("Déjà facturé — impossible à modifier")

  await db
    .update(monthlyPubRevenue)
    .set({
      validatedRevenueCents: parsed.validatedRevenueCents,
      validatedAt: new Date(),
      validatedBy: userId,
      notes: parsed.notes?.trim() || null,
      status: "validated",
      updatedAt: new Date(),
    })
    .where(eq(monthlyPubRevenue.id, parsed.declarationId))

  revalidatePath(`/admin/clients/${row.clientId}`)
  revalidatePath("/admin/clients")
  revalidatePath("/dashboard")
}

export async function unvalidatePubRevenueAction(declarationId: string) {
  await assertAgency()

  const [row] = await db
    .select()
    .from(monthlyPubRevenue)
    .where(eq(monthlyPubRevenue.id, declarationId))
  if (!row) throw new Error("Déclaration introuvable")
  if (row.status === "invoiced") throw new Error("Déjà facturé — impossible à modifier")

  await db
    .update(monthlyPubRevenue)
    .set({
      validatedRevenueCents: null,
      validatedAt: null,
      validatedBy: null,
      status: row.declaredRevenueCents !== null ? "declared" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(monthlyPubRevenue.id, declarationId))

  revalidatePath(`/admin/clients/${row.clientId}`)
  revalidatePath("/dashboard")
}

export async function updateShootDateAction(
  clientId: string,
  date: string | null, // YYYY-MM-DD from a date input, or null to clear
) {
  await assertAgency()

  const { clients } = await import("@/db/schema")
  let parsed: Date | null = null
  if (date) {
    // Interpret YYYY-MM-DD as local midnight — we only care about the day
    const d = new Date(`${date}T00:00:00`)
    if (Number.isNaN(d.getTime())) throw new Error("Date invalide")
    parsed = d
  }

  await db
    .update(clients)
    .set({ shootDate: parsed, updatedAt: new Date() })
    .where(eq(clients.id, clientId))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/clients")
  revalidatePath("/dashboard")
}
