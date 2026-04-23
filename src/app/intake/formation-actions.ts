"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { del } from "@vercel/blob"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clientFormationIntake, clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const livretSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(500),
  pathname: z.string().min(1),
  url: z.string().url(),
  size: z.number().int().nonnegative(),
  contentType: z.string().optional(),
})

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

export async function completeFormationIntakeAction(
  input: z.infer<typeof livretSchema>,
) {
  const parsed = livretSchema.parse(input)
  await assertCanEditClient(parsed.clientId)

  // If a livret already exists, delete the old blob before replacing
  const [existing] = await db
    .select()
    .from(clientFormationIntake)
    .where(eq(clientFormationIntake.clientId, parsed.clientId))

  if (existing?.livretUrl && existing.livretUrl !== parsed.url) {
    try {
      await del(existing.livretUrl)
    } catch (err) {
      console.error("[completeFormationIntake] old livret cleanup failed:", err)
    }
  }

  const now = new Date()
  const values = {
    clientId: parsed.clientId,
    livretUrl: parsed.url,
    livretName: parsed.name,
    livretPathname: parsed.pathname,
    livretSize: parsed.size,
    livretContentType: parsed.contentType ?? null,
    completedAt: now,
    updatedAt: now,
  }

  await db
    .insert(clientFormationIntake)
    .values(values)
    .onConflictDoUpdate({
      target: clientFormationIntake.clientId,
      set: {
        livretUrl: values.livretUrl,
        livretName: values.livretName,
        livretPathname: values.livretPathname,
        livretSize: values.livretSize,
        livretContentType: values.livretContentType,
        completedAt: values.completedAt,
        updatedAt: values.updatedAt,
      },
    })

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${parsed.clientId}`)
}
