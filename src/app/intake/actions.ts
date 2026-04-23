"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clientIntake, clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

const FIELD_KEYS = [
  "brandName",
  "targetAudience",
  "topProblems",
  "offerDifferentiator",
  "topBenefits",
  "commonObjections",
  "objectionResponses",
  "brandStory",
  "bestResults",
  "currentOffer",
] as const

export type IntakeFieldKey = (typeof FIELD_KEYS)[number]

const intakePartialSchema = z.object({
  clientId: z.string().uuid(),
  brandName: z.string().max(500).optional().nullable(),
  targetAudience: z.string().max(4000).optional().nullable(),
  topProblems: z.string().max(4000).optional().nullable(),
  offerDifferentiator: z.string().max(4000).optional().nullable(),
  topBenefits: z.string().max(4000).optional().nullable(),
  commonObjections: z.string().max(4000).optional().nullable(),
  objectionResponses: z.string().max(4000).optional().nullable(),
  brandStory: z.string().max(4000).optional().nullable(),
  bestResults: z.string().max(4000).optional().nullable(),
  currentOffer: z.string().max(4000).optional().nullable(),
})

type IntakeInput = z.infer<typeof intakePartialSchema>

async function assertCanEditClient(clientId: string) {
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

function cleanString(v: string | null | undefined): string | null {
  if (!v) return null
  const trimmed = v.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** Upsert a partial draft without marking the intake as complete. */
export async function saveIntakeDraftAction(input: IntakeInput) {
  const parsed = intakePartialSchema.parse(input)
  await assertCanEditClient(parsed.clientId)

  const values = {
    clientId: parsed.clientId,
    brandName: cleanString(parsed.brandName),
    targetAudience: cleanString(parsed.targetAudience),
    topProblems: cleanString(parsed.topProblems),
    offerDifferentiator: cleanString(parsed.offerDifferentiator),
    topBenefits: cleanString(parsed.topBenefits),
    commonObjections: cleanString(parsed.commonObjections),
    objectionResponses: cleanString(parsed.objectionResponses),
    brandStory: cleanString(parsed.brandStory),
    bestResults: cleanString(parsed.bestResults),
    currentOffer: cleanString(parsed.currentOffer),
    updatedAt: new Date(),
  }

  await db
    .insert(clientIntake)
    .values(values)
    .onConflictDoUpdate({
      target: clientIntake.clientId,
      set: {
        brandName: values.brandName,
        targetAudience: values.targetAudience,
        topProblems: values.topProblems,
        offerDifferentiator: values.offerDifferentiator,
        topBenefits: values.topBenefits,
        commonObjections: values.commonObjections,
        objectionResponses: values.objectionResponses,
        brandStory: values.brandStory,
        bestResults: values.bestResults,
        currentOffer: values.currentOffer,
        updatedAt: values.updatedAt,
      },
    })

  revalidatePath("/dashboard")
}

/** Mark the intake as complete — only succeeds when every required field is present. */
export async function completeIntakeAction(input: IntakeInput) {
  const parsed = intakePartialSchema.parse(input)
  await assertCanEditClient(parsed.clientId)

  const cleaned = {
    clientId: parsed.clientId,
    brandName: cleanString(parsed.brandName),
    targetAudience: cleanString(parsed.targetAudience),
    topProblems: cleanString(parsed.topProblems),
    offerDifferentiator: cleanString(parsed.offerDifferentiator),
    topBenefits: cleanString(parsed.topBenefits),
    commonObjections: cleanString(parsed.commonObjections),
    objectionResponses: cleanString(parsed.objectionResponses),
    brandStory: cleanString(parsed.brandStory),
    bestResults: cleanString(parsed.bestResults),
    currentOffer: cleanString(parsed.currentOffer),
  }

  const missing = FIELD_KEYS.filter((k) => !cleaned[k])
  if (missing.length > 0) {
    throw new Error(`Champs manquants : ${missing.join(", ")}`)
  }

  const now = new Date()
  await db
    .insert(clientIntake)
    .values({
      ...cleaned,
      completedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: clientIntake.clientId,
      set: {
        brandName: cleaned.brandName,
        targetAudience: cleaned.targetAudience,
        topProblems: cleaned.topProblems,
        offerDifferentiator: cleaned.offerDifferentiator,
        topBenefits: cleaned.topBenefits,
        commonObjections: cleaned.commonObjections,
        objectionResponses: cleaned.objectionResponses,
        brandStory: cleaned.brandStory,
        bestResults: cleaned.bestResults,
        currentOffer: cleaned.currentOffer,
        completedAt: now,
        updatedAt: now,
      },
    })

  revalidatePath("/dashboard")
  revalidatePath(`/admin/clients/${parsed.clientId}`)
}
