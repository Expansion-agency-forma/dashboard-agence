import { db } from "@/db/client"
import { onboardingSteps } from "@/db/schema"

export const DEFAULT_STEPS = [
  {
    title: "Script",
    description:
      "Rédaction et validation du script pédagogique avec le formateur.",
  },
  {
    title: "Tournage",
    description:
      "Captation sur site — studio ou lieu d'exercice selon le brief.",
  },
  {
    title: "Montage",
    description:
      "Découpe, habillage graphique, sous-titres et export en modules.",
  },
  {
    title: "Lancement",
    description:
      "Mise en ligne, activation du tunnel de vente et des campagnes publicitaires.",
  },
] as const

export type DefaultStepTitle = (typeof DEFAULT_STEPS)[number]["title"]

export function getStepDescription(title: string): string | null {
  return DEFAULT_STEPS.find((s) => s.title === title)?.description ?? null
}

/**
 * Insert the default onboarding steps for a freshly created client.
 */
export async function seedDefaultSteps(clientId: string) {
  await db.insert(onboardingSteps).values(
    DEFAULT_STEPS.map((step, idx) => ({
      clientId,
      title: step.title,
      stepOrder: idx + 1,
    })),
  )
}

export const STEP_STATUS_LABELS: Record<"pending" | "in_progress" | "done", string> = {
  pending: "À faire",
  in_progress: "En cours",
  done: "Terminée",
}
