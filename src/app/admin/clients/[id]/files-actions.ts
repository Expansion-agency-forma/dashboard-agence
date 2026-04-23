"use server"

import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clientFiles, clients } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const registerFileSchema = z.object({
  clientId: z.string().uuid(),
  stepId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(500),
  pathname: z.string().min(1),
  url: z.string().url(),
  contentType: z.string().optional(),
  size: z.number().int().nonnegative(),
  description: z.string().max(500).optional(),
})

async function assertCanAccessClient(clientId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const role = await getRole()
  if (role === "agency") return { userId }

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress.toLowerCase()
  if (!email) throw new Error("Unauthorized")
  const [row] = await db.select().from(clients).where(eq(clients.id, clientId))
  if (!row || row.email !== email) throw new Error("Accès interdit")
  return { userId }
}

export async function registerFileAction(input: z.infer<typeof registerFileSchema>) {
  const parsed = registerFileSchema.parse(input)
  const { userId } = await assertCanAccessClient(parsed.clientId)

  await db.insert(clientFiles).values({
    clientId: parsed.clientId,
    stepId: parsed.stepId ?? null,
    name: parsed.name,
    pathname: parsed.pathname,
    url: parsed.url,
    contentType: parsed.contentType ?? null,
    size: parsed.size,
    description: parsed.description ?? null,
    uploadedBy: userId,
  })

  revalidatePath(`/admin/clients/${parsed.clientId}`)
  revalidatePath("/dashboard")
}

export async function deleteFileAction(fileId: string) {
  const { userId: _userId } = await auth()
  const role = await getRole()
  if (!role) throw new Error("Unauthorized")

  const [file] = await db
    .select()
    .from(clientFiles)
    .where(eq(clientFiles.id, fileId))
  if (!file) throw new Error("Fichier introuvable")

  // Clients can only delete files attached to their own client row
  await assertCanAccessClient(file.clientId)

  // Best-effort: delete from Blob, then from DB
  try {
    await del(file.url)
  } catch (err) {
    console.error("[deleteFileAction] Blob delete failed:", err)
  }

  await db
    .delete(clientFiles)
    .where(and(eq(clientFiles.id, fileId), eq(clientFiles.clientId, file.clientId)))

  revalidatePath(`/admin/clients/${file.clientId}`)
  revalidatePath("/dashboard")
}
