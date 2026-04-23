"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clientAccess, clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"

const accessSchema = z.object({
  clientId: z.string().uuid(),
  facebookEmail: z.string().max(320).optional().nullable(),
  facebookPassword: z.string().max(500).optional().nullable(),
  // sentinel values indicating the user doesn't want to change the stored password
  facebookPasswordKeep: z.enum(["keep", "change"]).optional(),
  instagramEmail: z.string().max(320).optional().nullable(),
  instagramPassword: z.string().max(500).optional().nullable(),
  instagramPasswordKeep: z.enum(["keep", "change"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

type Input = z.infer<typeof accessSchema>

export type UpsertAccessState =
  | { ok: true }
  | { ok: false; message: string }
  | null

function cleanString(v: string | null | undefined): string | null {
  if (!v) return null
  const trimmed = v.trim()
  return trimmed.length === 0 ? null : trimmed
}

async function assertCanEditClient(clientId: string): Promise<string> {
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

export async function upsertAccessAction(
  _prev: UpsertAccessState,
  formData: FormData,
): Promise<UpsertAccessState> {
  const input: Input = {
    clientId: String(formData.get("clientId") ?? ""),
    facebookEmail: formData.get("facebookEmail")?.toString() ?? null,
    facebookPassword: formData.get("facebookPassword")?.toString() ?? null,
    facebookPasswordKeep:
      (formData.get("facebookPasswordKeep")?.toString() as "keep" | "change") ??
      "change",
    instagramEmail: formData.get("instagramEmail")?.toString() ?? null,
    instagramPassword: formData.get("instagramPassword")?.toString() ?? null,
    instagramPasswordKeep:
      (formData.get("instagramPasswordKeep")?.toString() as "keep" | "change") ??
      "change",
    notes: formData.get("notes")?.toString() ?? null,
  }

  const parsed = accessSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Champs invalides." }
  }

  let userId: string
  try {
    userId = await assertCanEditClient(parsed.data.clientId)
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unauthorized" }
  }

  const [existing] = await db
    .select()
    .from(clientAccess)
    .where(eq(clientAccess.clientId, parsed.data.clientId))

  const fbPwPlain = cleanString(parsed.data.facebookPassword)
  const igPwPlain = cleanString(parsed.data.instagramPassword)
  const keepFb = parsed.data.facebookPasswordKeep === "keep"
  const keepIg = parsed.data.instagramPasswordKeep === "keep"

  const facebookPasswordEnc = keepFb
    ? (existing?.facebookPasswordEnc ?? null)
    : fbPwPlain
      ? encrypt(fbPwPlain)
      : null
  const instagramPasswordEnc = keepIg
    ? (existing?.instagramPasswordEnc ?? null)
    : igPwPlain
      ? encrypt(igPwPlain)
      : null

  const values = {
    clientId: parsed.data.clientId,
    facebookEmail: cleanString(parsed.data.facebookEmail),
    facebookPasswordEnc,
    instagramEmail: cleanString(parsed.data.instagramEmail),
    instagramPasswordEnc,
    notes: cleanString(parsed.data.notes),
    updatedBy: userId,
    updatedAt: new Date(),
  }

  await db
    .insert(clientAccess)
    .values(values)
    .onConflictDoUpdate({
      target: clientAccess.clientId,
      set: {
        facebookEmail: values.facebookEmail,
        facebookPasswordEnc: values.facebookPasswordEnc,
        instagramEmail: values.instagramEmail,
        instagramPasswordEnc: values.instagramPasswordEnc,
        notes: values.notes,
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
      },
    })

  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
  revalidatePath("/dashboard")

  return { ok: true }
}
