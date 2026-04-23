"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const createClientSchema = z.object({
  name: z.string().min(1, "Nom requis").max(120),
  email: z.string().email("Email invalide").toLowerCase(),
  company: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
})

export type CreateClientState =
  | { ok: true; clientId: string }
  | { ok: false; errors: Record<string, string[]>; message?: string }
  | null

export async function createClientAction(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const role = await getRole()
  if (role !== "agency") {
    return { ok: false, errors: {}, message: "Non autorisé." }
  }

  const { userId } = await auth()
  if (!userId) {
    return { ok: false, errors: {}, message: "Session expirée." }
  }

  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
  })

  if (!parsed.success) {
    return {
      ok: false,
      errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  const { name, email, company } = parsed.data

  // Insert the client first — source of truth is our DB
  let clientId: string
  try {
    const [row] = await db
      .insert(clients)
      .values({
        name,
        email,
        company,
        createdBy: userId,
      })
      .returning({ id: clients.id })
    clientId = row.id
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue"
    if (msg.toLowerCase().includes("unique")) {
      return {
        ok: false,
        errors: { email: ["Un client avec cet email existe déjà."] },
      }
    }
    return { ok: false, errors: {}, message: msg }
  }

  // Fire-and-forget Clerk invitation so the client receives a magic link.
  // Failure doesn't block — admin can resend / copy link from the clients list later.
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
    console.error("[createClientAction] Clerk invitation failed:", err)
    // The DB row still exists — admin can retry from the clients list.
  }

  revalidatePath("/admin/clients")
  redirect("/admin/clients")
}

export async function resendInvitationAction(clientId: string) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  const [row] = await db.select().from(clients).where(eq(clients.id, clientId))
  if (!row) throw new Error("Client introuvable")
  if (row.status !== "invited") throw new Error("Ce client n'est pas en statut 'invité'")

  const client = await clerkClient()
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  const invitation = await client.invitations.createInvitation({
    emailAddress: row.email,
    redirectUrl: `${origin}/sign-up`,
    publicMetadata: { role: "client", clientId: row.id },
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

  revalidatePath("/admin/clients")
}

export async function deleteClientAction(clientId: string) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  await db.delete(clients).where(eq(clients.id, clientId))
  revalidatePath("/admin/clients")
}
