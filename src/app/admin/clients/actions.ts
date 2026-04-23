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
  // Failure doesn't block — admin can resend from the client detail page later.
  try {
    const client = await clerkClient()
    await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role: "client", clientId },
      notify: true,
      ignoreExisting: true,
    })
  } catch (err) {
    console.error("[createClientAction] Clerk invitation failed:", err)
    // Surface a soft warning via state? For MVP we just log and continue.
  }

  revalidatePath("/admin/clients")
  redirect("/admin/clients")
}

export async function deleteClientAction(clientId: string) {
  const role = await getRole()
  if (role !== "agency") throw new Error("Unauthorized")

  await db.delete(clients).where(eq(clients.id, clientId))
  revalidatePath("/admin/clients")
}
