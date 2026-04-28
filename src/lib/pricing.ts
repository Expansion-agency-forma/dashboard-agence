// Pricing rules — auto-entrepreneur, no VAT (art. 293 B CGI).
// All amounts are stored and computed in cents (centimes d'euro) to avoid float issues.

export const PUB_REVENUE_SHARE = 0.2 // 20 % du CA généré grâce à la pub

export const FORMATION_DAY_1_CENTS = 200_000 // 2 000 € pour 1 jour de tournage
export const FORMATION_DAY_2_CENTS = 300_000 // 3 000 € pour 2 jours (total)
export const FORMATION_EXTRA_DAY_CENTS = 50_000 // +500 € par jour supplémentaire au-delà de 2

/** Formation price in cents based on the number of shooting days (>= 1).
 *  1 day = 2 000 €, 2 days = 3 000 €, then +500 € per additional day. */
export function formationPriceCents(days: number): number {
  if (!Number.isFinite(days) || days < 1) return 0
  const d = Math.floor(days)
  if (d === 1) return FORMATION_DAY_1_CENTS
  if (d === 2) return FORMATION_DAY_2_CENTS
  return FORMATION_DAY_2_CENTS + FORMATION_EXTRA_DAY_CENTS * (d - 2)
}

/** 20 % of declared revenue, in cents. Rounded to the nearest cent. */
export function pubInvoiceCents(revenueCents: number): number {
  if (!Number.isFinite(revenueCents) || revenueCents <= 0) return 0
  return Math.round(revenueCents * PUB_REVENUE_SHARE)
}

/** Format cents as a French euro string ("1 234,56 €"). */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** Convert "12,50" or "12.50" or "1234" (euros) to cents. Returns null on invalid input. */
export function parseEurosToCents(input: string): number | null {
  if (!input) return null
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const euros = Number(normalized)
  if (!Number.isFinite(euros) || euros < 0) return null
  return Math.round(euros * 100)
}

/** Current period as YYYY-MM (e.g. "2026-04"). Optional `date` for testing. */
export function currentPeriodMonth(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

/** Human label for a YYYY-MM period ("avril 2026"). */
export function formatPeriodMonth(period: string): string {
  const [y, m] = period.split("-").map(Number)
  if (!y || !m) return period
  const d = new Date(y, m - 1, 1)
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(d)
}

/** Previous period as YYYY-MM (defaults relative to today). */
export function previousPeriodMonth(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  return currentPeriodMonth(d)
}

/**
 * Profitability tiers shown on formation quotes — how many trainings the
 * prospect would need to sell at each price point to recoup the formation cost.
 */
export const PROFITABILITY_TIERS_CENTS = [20_000, 50_000, 100_000] as const

export type ProfitabilityTier = {
  sellPriceCents: number
  salesNeeded: number
}

/** Compute sales needed to break even for a formation cost across given price tiers. */
export function formationProfitability(
  totalCostCents: number,
  tiers: readonly number[] = PROFITABILITY_TIERS_CENTS,
): ProfitabilityTier[] {
  if (totalCostCents <= 0) return []
  return tiers.map((sellPriceCents) => ({
    sellPriceCents,
    salesNeeded:
      sellPriceCents > 0 ? Math.ceil(totalCostCents / sellPriceCents) : 0,
  }))
}

/** Deposit charged to the prospect when they accept a quote that includes a
 *  formation — locks in the shooting date. 10 % of the formation total
 *  (formation + travel). Returns 0 when there's no formation in scope. */
export const QUOTE_DEPOSIT_RATE = 0.1

export function computeQuoteDepositCents(input: {
  services: string[]
  formationDays: number | null
  formationTravelCents: number | null
}): number {
  if (!input.services.includes("formation")) return 0
  if (!input.formationDays || input.formationDays < 1) return 0
  const formation = formationPriceCents(input.formationDays)
  const total = formation + (input.formationTravelCents ?? 0)
  return Math.round(total * QUOTE_DEPOSIT_RATE)
}
