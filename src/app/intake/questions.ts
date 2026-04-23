import type { IntakeFieldKey } from "./actions"

export type IntakeQuestion = {
  key: IntakeFieldKey
  number: number
  label: string
  hint?: string
  placeholder?: string
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    key: "brandName",
    number: 1,
    label: "Comment s'appelle votre marque ou activité ?",
    hint: "Le nom sous lequel vos clients vous connaissent.",
    placeholder: "Ex. Institut Beauté & Co",
  },
  {
    key: "targetAudience",
    number: 2,
    label: "À qui s'adresse votre offre ? Qui est votre client idéal ?",
    hint: "Âge, profession, situation, aspirations. Soyez précis.",
    placeholder: "Femmes de 30-45 ans, entrepreneures dans le domaine du bien-être…",
  },
  {
    key: "topProblems",
    number: 3,
    label:
      "Quels sont les 3 plus gros problèmes que rencontrent vos clients avant d'acheter votre offre ?",
    hint: "Ce qui les empêche de dormir la nuit.",
    placeholder: "1) …\n2) …\n3) …",
  },
  {
    key: "offerDifferentiator",
    number: 4,
    label: "Qu'est-ce que votre offre apporte de plus que les autres ?",
    hint: "Votre avantage concurrentiel, ce qui vous rend unique.",
  },
  {
    key: "topBenefits",
    number: 5,
    label:
      "Quels sont les 3 principaux bénéfices que vos clients obtiennent grâce à votre offre ?",
    placeholder: "1) …\n2) …\n3) …",
  },
  {
    key: "commonObjections",
    number: 6,
    label: "Quelles sont les objections les plus courantes de vos prospects avant d'acheter ?",
    hint: "Ce qui les freine, leurs doutes.",
  },
  {
    key: "objectionResponses",
    number: 7,
    label: "Comment répondez-vous à ces objections ?",
    hint: "Vos arguments clés pour rassurer.",
  },
  {
    key: "brandStory",
    number: 8,
    label: "Quelle est l'histoire derrière votre marque ou entreprise ?",
    hint: "L'étincelle, le parcours, pourquoi vous avez lancé ça.",
  },
  {
    key: "bestResults",
    number: 9,
    label: "Quels sont les résultats les plus impressionnants que vos clients ont obtenus ?",
    hint: "Cas concrets, chiffres si possible.",
  },
  {
    key: "currentOffer",
    number: 10,
    label: "Détaillez votre offre actuelle.",
    hint: "Produits/services, prix, bonus, garanties.",
  },
]

export const INTAKE_QUESTION_LABELS: Record<IntakeFieldKey, string> =
  Object.fromEntries(INTAKE_QUESTIONS.map((q) => [q.key, q.label])) as Record<
    IntakeFieldKey,
    string
  >
