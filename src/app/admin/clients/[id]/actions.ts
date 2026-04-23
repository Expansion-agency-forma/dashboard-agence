"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db } from "@/db/client"
import { clients, onboardingSteps } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const statusSchema = z.enum(["pending", "in_progress", "done"])

export async function updateStepStatusAction(
  stepId: string,
  clientId: string,
  nextStatus: "pending" | "in_progress" | "done",
) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")
  const parsed = statusSchema.parse(nextStatus)

  await db
    .update(onboardingSteps)
    .set({
      status: parsed,
      completedAt: parsed === "done" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(onboardingSteps.id, stepId), eq(onboardingSteps.clientId, clientId)))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/clients")
  revalidatePath("/dashboard")
}

export async function updateStepNotesAction(
  stepId: string,
  clientId: string,
  notes: string,
) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  const safeNotes = notes.trim().slice(0, 2000)
  await db
    .update(onboardingSteps)
    .set({
      notes: safeNotes.length === 0 ? null : safeNotes,
      updatedAt: new Date(),
    })
    .where(and(eq(onboardingSteps.id, stepId), eq(onboardingSteps.clientId, clientId)))

  revalidatePath(`/admin/clients/${clientId}`)
}

export async function archiveClientAction(clientId: string) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  await db
    .update(clients)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(clients.id, clientId))

  revalidatePath("/admin/clients")
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function reactivateClientAction(clientId: string) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  const [row] = await db.select().from(clients).where(eq(clients.id, clientId))
  if (!row) throw new Error("Client introuvable")

  await db
    .update(clients)
    .set({
      status: row.clerkUserId ? "active" : "invited",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId))

  revalidatePath("/admin/clients")
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function deleteClientAction(clientId: string) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  await db.delete(clients).where(eq(clients.id, clientId))
  revalidatePath("/admin/clients")
  redirect("/admin/clients")
}
