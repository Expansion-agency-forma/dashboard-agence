import { notFound } from "next/navigation"
import { db } from "@/db/client"
import { quotes } from "@/db/schema"
import { eq } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { BrandMark } from "@/components/brand-mark"
import {
  CheckCircle2,
  Clock,
  GraduationCap,
  Megaphone,
  PenLine,
  Scissors,
  ShieldCheck,
  Sparkles,
  Video,
  XCircle,
} from "lucide-react"
import {
  formationPriceCents,
  formationProfitability,
  formatEuros,
  PROFITABILITY_TIERS_CENTS,
  pubInvoiceCents,
} from "@/lib/pricing"
import { DecisionButtons } from "./decision-buttons"
import { PrintButton } from "./print-button"
import { computeQuoteDepositCents } from "@/lib/pricing"
import { expireQuoteIfNeeded, verifyDepositSessionAction } from "./actions"

export const dynamic = "force-dynamic"

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ session_id?: string; cancelled?: string }>
}) {
  const { token } = await params
  const { session_id, cancelled } = await searchParams

  let [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, token))
  if (!quote) notFound()

  let depositJustVerifiedError: string | null = null
  if (session_id) {
    // Returning from Stripe Checkout — verify the payment server-side and
    // trigger acceptance if it succeeded. Idempotent.
    const res = await verifyDepositSessionAction(token, session_id)
    if (!res.ok) {
      depositJustVerifiedError = res.error
    } else {
      // Re-fetch the quote to reflect the new state.
      const [refreshed] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.publicToken, token))
      if (refreshed) quote = refreshed
    }
  }

  const depositCancelled = cancelled === "true"

  // Auto-expire if past deadline and still pending
  const isExpired =
    quote.status === "expired" ||
    (quote.status !== "accepted" &&
      quote.status !== "rejected" &&
      quote.expiresAt.getTime() < Date.now())
  if (
    isExpired &&
    quote.status !== "expired" &&
    quote.status !== "accepted" &&
    quote.status !== "rejected"
  ) {
    await expireQuoteIfNeeded(quote.id)
  }

  const hasPub = quote.services.includes("pub")
  const hasFormation = quote.services.includes("formation")

  const formationCents =
    hasFormation && quote.formationDays
      ? formationPriceCents(quote.formationDays)
      : 0
  const formationTotalCents = formationCents + (quote.formationTravelCents ?? 0)
  const profitability =
    hasFormation && formationTotalCents > 0
      ? formationProfitability(formationTotalCents, PROFITABILITY_TIERS_CENTS)
      : null
  const pubMonthlyCents =
    hasPub && quote.pubExpectedMonthlyRevenueCents
      ? pubInvoiceCents(quote.pubExpectedMonthlyRevenueCents)
      : null

  const depositCents = computeQuoteDepositCents({
    services: quote.services,
    formationDays: quote.formationDays,
    formationTravelCents: quote.formationTravelCents,
  })

  const isAccepted = quote.status === "accepted"
  const isRejected = quote.status === "rejected"
  const isPending = !isAccepted && !isRejected && !isExpired

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-10 md:py-16">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Expansion Agency
            </p>
            <p className="text-sm font-medium">Proposition commerciale</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton />
          <Badge
            variant="outline"
            className={
              isAccepted
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : isRejected
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : isExpired
                    ? "border-zinc-500/30 bg-zinc-500/10 text-muted-foreground"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }
          >
            {isAccepted
              ? "Accepté"
              : isRejected
                ? "Refusé"
                : isExpired
                  ? "Expiré"
                  : "À valider"}
          </Badge>
        </div>
      </header>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-[var(--brand-gold)]">
          Bonjour
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="brand-italic text-[var(--brand-gold)]">
            {quote.prospectName}
          </span>
        </h1>
        {(quote.prospectCompany || quote.prospectDomain || quote.prospectSiret) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {quote.prospectCompany && <span>{quote.prospectCompany}</span>}
            {quote.prospectDomain && (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/60">·</span>
                {quote.prospectDomain}
              </span>
            )}
            {quote.prospectSiret && (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/60">·</span>
                <span className="font-mono text-xs">
                  SIRET {quote.prospectSiret}
                </span>
              </span>
            )}
          </div>
        )}
        <p className="text-base leading-relaxed text-muted-foreground">
          Voici la proposition d&apos;Expansion Agency pour vous accompagner.
          Prenez le temps de la lire et acceptez quand vous êtes prêt — votre
          espace de production sera créé dans la foulée.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Prestations proposées
        </h2>

        {hasPub && (
          <div className="space-y-3 rounded-2xl border border-border bg-card/40 p-6">
            <div className="flex items-start gap-3">
              <Megaphone size={20} className="mt-0.5 text-[var(--brand-gold)]" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Publicité</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stratégie, création, diffusion et optimisation de vos
                  campagnes Meta · TikTok · YouTube · Snap. Tarification
                  alignée sur votre performance.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-4">
              <p className="text-sm font-semibold">
                20 % du chiffre d&apos;affaires généré grâce à la pub
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Facturé chaque mois sur la base du CA que vous déclarez. Vous ne
                payez que si la pub fonctionne.
              </p>
              {pubMonthlyCents !== null && quote.pubExpectedMonthlyRevenueCents && (
                <p className="mt-3 border-t border-[var(--brand-gold-border)] pt-3 text-sm">
                  <span className="font-medium">Estimation :</span> sur la base
                  d&apos;un CA mensuel attendu de{" "}
                  <span className="font-semibold">
                    {formatEuros(quote.pubExpectedMonthlyRevenueCents)}
                  </span>
                  , votre facture mensuelle serait d&apos;environ{" "}
                  <span className="font-semibold text-[var(--brand-gold)]">
                    {formatEuros(pubMonthlyCents)}
                  </span>
                  .
                </p>
              )}
            </div>
          </div>
        )}

        {hasFormation && (
          <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-6">
            <div className="flex items-start gap-3">
              <GraduationCap
                size={20}
                className="mt-0.5 text-[var(--brand-gold)]"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Formation en ligne</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Une formation en ligne professionnelle, clé en main, à votre
                  image — prête à être vendue dès la livraison.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Notre méthode
              </h4>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <PenLine
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                  />
                  <div>
                    <span className="font-semibold">
                      Écriture complète des scripts
                    </span>
                    <span className="text-muted-foreground">
                      {" "}— notre équipe rédige l&apos;intégralité de vos
                      modules à partir de votre expertise. Vous n&apos;avez
                      qu&apos;à parler face caméra.
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Video
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                  />
                  <div>
                    <span className="font-semibold">
                      Tournage avec matériel professionnel
                    </span>
                    <span className="text-muted-foreground">
                      {" "}— nous venons sur place équipés : caméras, son,
                      éclairage, et{" "}
                      <span className="font-semibold text-foreground">
                        prompteur
                      </span>
                      . Vous lisez vos textes avec naturel, sans rien apprendre
                      par cœur.
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Scissors
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                  />
                  <div>
                    <span className="font-semibold">
                      Montage professionnel sous 3 semaines
                    </span>
                    <span className="text-muted-foreground">
                      {" "}— une première version vous est livrée dans les{" "}
                      <span className="font-semibold text-foreground">
                        3 semaines
                      </span>{" "}
                      qui suivent le tournage.
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <ShieldCheck
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                  />
                  <div>
                    <span className="font-semibold">
                      Validation sous 30 jours
                    </span>
                    <span className="text-muted-foreground">
                      {" "}— vous disposez de{" "}
                      <span className="font-semibold text-foreground">
                        30 jours après la livraison de la première version
                      </span>{" "}
                      pour valider la version finale.
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            {quote.formationDays ? (
              <>
                <ul className="space-y-1.5 rounded-lg border border-border bg-background/40 px-4 py-3 text-sm">
                  <li className="flex justify-between">
                    <span>
                      Formation — {quote.formationDays} jour
                      {quote.formationDays > 1 ? "s" : ""} de tournage
                    </span>
                    <span className="font-semibold">
                      {formatEuros(formationCents)}
                    </span>
                  </li>
                  {quote.formationTravelCents
                    ? quote.formationTravelCents > 0 && (
                        <li className="flex justify-between text-muted-foreground">
                          <span>Frais de déplacement</span>
                          <span className="font-semibold text-foreground">
                            {formatEuros(quote.formationTravelCents)}
                          </span>
                        </li>
                      )
                    : null}
                  <li className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                    <span>Total</span>
                    <span className="text-[var(--brand-gold)]">
                      {formatEuros(formationTotalCents)}
                    </span>
                  </li>
                  {depositCents > 0 && (
                    <li className="flex justify-between border-t border-border pt-1.5 text-sm text-muted-foreground">
                      <span>
                        Acompte à régler à l&apos;acceptation (10 %)
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatEuros(depositCents)}
                      </span>
                    </li>
                  )}
                </ul>

                {profitability && (
                  <div className="rounded-lg border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--brand-gold)]">
                      <Sparkles size={12} />
                      Votre rentabilité
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Combien de formations vous devez vendre pour rentabiliser
                      votre investissement, selon votre prix de vente :
                    </p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                      {profitability.map((t) => (
                        <li
                          key={t.sellPriceCents}
                          className="rounded-md border border-border bg-background/60 p-3 text-center"
                        >
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">
                            À {formatEuros(t.sellPriceCents)}
                          </p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--brand-gold)]">
                            {t.salesNeeded}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ventes
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {quote.notes && (
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Notes
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {quote.notes}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card/40 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={14} />
          {isExpired ? (
            <span>
              Ce devis a expiré le{" "}
              <span className="text-foreground">{formatDate(quote.expiresAt)}</span>.
            </span>
          ) : (
            <span>
              Valable jusqu&apos;au{" "}
              <span className="font-semibold text-foreground">
                {formatDate(quote.expiresAt)}
              </span>
              .
            </span>
          )}
        </div>

        {isPending && (
          <div className="print:hidden space-y-3">
            {depositCancelled && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                Paiement annulé — vous pouvez réessayer quand vous êtes prêt.
              </p>
            )}
            {depositJustVerifiedError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {depositJustVerifiedError}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {depositCents > 0 ? (
                <>
                  En cliquant sur le bouton, vous serez redirigé vers une page
                  Stripe sécurisée pour régler l&apos;acompte de{" "}
                  <span className="font-semibold text-foreground">
                    {formatEuros(depositCents)}
                  </span>{" "}
                  qui bloque votre date de tournage. Cet acompte sera déduit de
                  votre facture finale. Votre espace de production sera créé
                  automatiquement après le paiement.
                </>
              ) : (
                <>
                  En acceptant, votre espace de production sera créé et vous
                  recevrez un email pour le finaliser.
                </>
              )}
            </p>
            <DecisionButtons
              token={quote.publicToken}
              depositCents={depositCents}
              prefilledName={quote.prospectName}
            />
          </div>
        )}

        {isAccepted && (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={18} />
              <p className="font-semibold">Devis accepté — bienvenue !</p>
            </div>
            {quote.depositPaidAt && depositCents > 0 && (
              <p className="text-sm text-muted-foreground">
                Acompte de{" "}
                <span className="font-semibold text-foreground">
                  {formatEuros(quote.depositAmountCents ?? depositCents)}
                </span>{" "}
                bien reçu — votre date de tournage est bloquée.
              </p>
            )}
            <p className="text-sm text-muted-foreground print:hidden">
              Une invitation par email vous a été envoyée pour finaliser la
              création de votre espace. Si vous ne la voyez pas, vérifiez vos
              spams ou contactez l&apos;agence.
            </p>
          </div>
        )}

        {isAccepted && quote.signatureName && quote.signedAt && (
          <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Signature électronique
            </p>
            <p className="mt-2">
              Signé électroniquement par{" "}
              <span className="font-semibold">{quote.signatureName}</span>{" "}
              le{" "}
              <span className="font-semibold">
                {formatDateTime(quote.signedAt)}
              </span>
              .
            </p>
            {quote.signatureIp && (
              <p className="mt-1 text-xs text-muted-foreground">
                Adresse IP enregistrée :{" "}
                <span className="font-mono">{quote.signatureIp}</span>
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Signature électronique simple au sens du règlement eIDAS
              (UE n° 910/2014, art. 25).
            </p>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <XCircle size={18} />
            <p>Ce devis a été refusé.</p>
          </div>
        )}

        {isExpired && (
          <p className="text-sm text-muted-foreground">
            Si vous souhaitez toujours travailler avec nous, contactez-nous
            directement et nous regénérerons une proposition.
          </p>
        )}
      </section>

      <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
        Expansion Agency · Proposition n°{quote.id.slice(0, 8).toUpperCase()}
      </footer>
    </main>
  )
}
