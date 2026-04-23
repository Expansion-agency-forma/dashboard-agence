"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clientAccess, clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"

const preferenceSchema = z.enum(["invite", "create"])

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

/** Persist the client's choice (invite us on their account vs we create it) */
export async function setAdAccountPreferenceAction(
  clientId: string,
  preference: "invite" | "create",
) {
  const parsed = preferenceSchema.parse(preference)
  await assertCanEditClient(clientId)

  // Changing the choice resets the follow-up confirmation (invite_confirmed_at).
  await db
    .update(clients)
    .set({
      adAccountPreference: parsed,
      adAccountInviteConfirmedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId))

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${clientId}`)
}

/** Client confirms they have sent the ad-account invitation to the agency */
export async function confirmInviteSentAction(clientId: string) {
  await assertCanEditClient(clientId)

  await db
    .update(clients)
    .set({
      adAccountInviteConfirmedAt: new Date(),
      adAccountPreference: "invite",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId))

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${clientId}`)
}

const credentialsSchema = z.object({
  clientId: z.string().uuid(),
  facebookEmail: z.string().max(320).min(1, "Email Facebook requis"),
  facebookPassword: z.string().max(500).min(1, "Mot de passe Facebook requis"),
  instagramEmail: z.string().max(320).min(1, "Email/identifiant Instagram requis"),
  instagramPassword: z
    .string()
    .max(500)
    .min(1, "Mot de passe Instagram requis"),
})

/** Saves FB/IG credentials from the onboarding modal's "create" sub-step */
export async function saveOnboardingCredentialsAction(
  input: z.infer<typeof credentialsSchema>,
) {
  const parsed = credentialsSchema.parse(input)
  const userId = await assertCanEditClient(parsed.clientId)

  const values = {
    clientId: parsed.clientId,
    facebookEmail: parsed.facebookEmail.trim(),
    facebookPasswordEnc: encrypt(parsed.facebookPassword),
    instagramEmail: parsed.instagramEmail.trim(),
    instagramPasswordEnc: encrypt(parsed.instagramPassword),
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
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
      },
    })

  // Also stamp the preference so we know where they are in the flow.
  await db
    .update(clients)
    .set({
      adAccountPreference: "create",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, parsed.clientId))

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${parsed.clientId}`)
}
