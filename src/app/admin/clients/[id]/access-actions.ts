"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clientAccess, clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const accessSchema = z.object({
  clientId: z.string().uuid(),
  metaBusinessId: z.string().max(200).optional().nullable(),
  metaPageUrl: z.string().max(500).optional().nullable(),
  metaPixelId: z.string().max(200).optional().nullable(),
  metaAdAccountId: z.string().max(200).optional().nullable(),
  tiktokHandle: z.string().max(200).optional().nullable(),
  youtubeChannelUrl: z.string().max(500).optional().nullable(),
  snapchatHandle: z.string().max(200).optional().nullable(),
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
    metaBusinessId: formData.get("metaBusinessId")?.toString() ?? null,
    metaPageUrl: formData.get("metaPageUrl")?.toString() ?? null,
    metaPixelId: formData.get("metaPixelId")?.toString() ?? null,
    metaAdAccountId: formData.get("metaAdAccountId")?.toString() ?? null,
    tiktokHandle: formData.get("tiktokHandle")?.toString() ?? null,
    youtubeChannelUrl: formData.get("youtubeChannelUrl")?.toString() ?? null,
    snapchatHandle: formData.get("snapchatHandle")?.toString() ?? null,
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

  const values = {
    clientId: parsed.data.clientId,
    metaBusinessId: cleanString(parsed.data.metaBusinessId),
    metaPageUrl: cleanString(parsed.data.metaPageUrl),
    metaPixelId: cleanString(parsed.data.metaPixelId),
    metaAdAccountId: cleanString(parsed.data.metaAdAccountId),
    tiktokHandle: cleanString(parsed.data.tiktokHandle),
    youtubeChannelUrl: cleanString(parsed.data.youtubeChannelUrl),
    snapchatHandle: cleanString(parsed.data.snapchatHandle),
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
        metaBusinessId: values.metaBusinessId,
        metaPageUrl: values.metaPageUrl,
        metaPixelId: values.metaPixelId,
        metaAdAccountId: values.metaAdAccountId,
        tiktokHandle: values.tiktokHandle,
        youtubeChannelUrl: values.youtubeChannelUrl,
        snapchatHandle: values.snapchatHandle,
        notes: values.notes,
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
      },
    })

  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
  revalidatePath("/dashboard")

  return { ok: true }
}
