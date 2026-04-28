import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { db } from "@/db/client"
import { quotes } from "@/db/schema"
import { eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeft, ExternalLink } from "lucide-react"
import {
  computeQuoteDepositCents,
  formationPriceCents,
  formationProfitability,
  formatEuros,
  PROFITABILITY_TIERS_CENTS,
  pubInvoiceCents,
} from "@/lib/pricing"
import { QuoteAdminControls } from "./controls"
import { CopyLinkButton } from "./copy-link"

export const dynamic = "force-dynamic"

const statusStyles: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  sent: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20",
}
const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
}

function formatDateTime(d: Date | null): string {
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!quote) notFound()

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

  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "http"
  // Prefer the actual request host so the link works in any environment
  // (localhost in dev, prod domain in prod). NEXT_PUBLIC_APP_URL is only used
  // as a fallback when there's no request context (cron, background task).
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const publicUrl = `${origin}/q/${quote.publicToken}`

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-auto px-2 py-1">
            <Link href="/admin/quotes">
              <ArrowLeft size={14} />
              Devis
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Devis pour {quote.prospectName}
            </h1>
            <Badge variant="outline" className={statusStyles[quote.status]}>
              {statusLabels[quote.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote.prospectEmail}
            {quote.prospectCompany && <> · {quote.prospectCompany}</>}
            {quote.prospectDomain && <> · {quote.prospectDomain}</>}
            {quote.prospectSiret && (
              <>
                {" "}· <span className="font-mono">SIRET {quote.prospectSiret}</span>
              </>
            )}
          </p>
        </div>
        <QuoteAdminControls
          quoteId={quote.id}
          status={quote.status}
          clientId={quote.clientId}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lien public</CardTitle>
          <CardDescription>
            Le prospect ouvre ce lien pour consulter et accepter le devis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <code className="flex-1 truncate rounded-md border border-border bg-card/40 px-3 py-2 font-mono text-xs">
            {publicUrl}
          </code>
          <CopyLinkButton url={publicUrl} />
          <Button asChild variant="outline" size="sm">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={12} />
              Ouvrir
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des prestations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasPub && (
            <div className="space-y-2 rounded-md border border-border bg-card/40 p-4">
              <p className="font-medium">Publicité</p>
              <p className="text-sm text-muted-foreground">
                20 % du chiffre d&apos;affaires généré grâce à la pub, facturé
                mensuellement.
              </p>
              {pubMonthlyCents !== null && quote.pubExpectedMonthlyRevenueCents && (
                <p className="text-sm">
                  Estimation mensuelle :{" "}
                  <span className="font-semibold">
                    {formatEuros(pubMonthlyCents)}
                  </span>{" "}
                  {" "}sur la base d&apos;un CA de{" "}
                  <span className="font-semibold">
                    {formatEuros(quote.pubExpectedMonthlyRevenueCents)}
                  </span>
                  /mois.
                </p>
              )}
            </div>
          )}

          {hasFormation && (
            <div className="space-y-3 rounded-md border border-border bg-card/40 p-4">
              <p className="font-medium">Formation en ligne</p>
              {quote.formationDays ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {quote.formationDays} jour
                    {quote.formationDays > 1 ? "s" : ""} de tournage ·{" "}
                    {formatEuros(formationCents)}
                    {quote.formationTravelCents
                      ? ` + déplacement ${formatEuros(quote.formationTravelCents)}`
                      : ""}
                  </p>
                  <p className="text-base font-semibold">
                    Total :{" "}
                    <span className="text-[var(--brand-gold)]">
                      {formatEuros(formationTotalCents)}
                    </span>
                  </p>
                  {profitability && (
                    <div className="mt-3 rounded-md border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-3">
                      <p className="text-xs font-medium uppercase tracking-widest text-[var(--brand-gold)]">
                        Rentabilité
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {profitability.map((t) => (
                          <li key={t.sellPriceCents}>
                            À{" "}
                            <span className="font-semibold">
                              {formatEuros(t.sellPriceCents)}
                            </span>
                            {" "}/ formation vendue, vous en vendez{" "}
                            <span className="font-semibold">
                              {t.salesNeeded}
                            </span>
                            {" "}pour rentabiliser votre investissement.
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pas de jours de tournage saisis.
                </p>
              )}
            </div>
          )}

          {quote.notes && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Notes
              </p>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-card/40 px-3 py-2 text-sm">
                {quote.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {depositCents > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acompte</CardTitle>
            <CardDescription>
              10 % du total formation, demandé au prospect au moment de
              l&apos;acceptation pour bloquer la date de tournage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                <span className="brand-italic text-[var(--brand-gold)]">
                  {formatEuros(quote.depositAmountCents ?? depositCents)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {quote.depositPaidAt
                  ? `Réglé le ${formatDateTime(quote.depositPaidAt)}`
                  : quote.depositStripeSessionId
                    ? "Session de paiement créée — en attente du règlement"
                    : "Sera demandé au prospect à l'acceptation du devis"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                quote.depositPaidAt
                  ? "ml-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : quote.depositStripeSessionId
                    ? "ml-auto border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "ml-auto border-zinc-500/30 bg-zinc-500/10 text-muted-foreground"
              }
            >
              {quote.depositPaidAt
                ? "Payé"
                : quote.depositStripeSessionId
                  ? "En attente"
                  : "Pas encore demandé"}
            </Badge>
          </CardContent>
        </Card>
      )}

      {quote.signatureName && quote.signedAt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signature électronique</CardTitle>
            <CardDescription>
              Audit trail — signature électronique simple (eIDAS art. 25).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[200px_1fr]">
              <dt className="text-muted-foreground">Nom signé</dt>
              <dd className="font-semibold">{quote.signatureName}</dd>
              <dt className="text-muted-foreground">Signé le</dt>
              <dd>{formatDateTime(quote.signedAt)}</dd>
              {quote.signatureIp && (
                <>
                  <dt className="text-muted-foreground">Adresse IP</dt>
                  <dd className="font-mono">{quote.signatureIp}</dd>
                </>
              )}
              {quote.signatureUserAgent && (
                <>
                  <dt className="text-muted-foreground">User agent</dt>
                  <dd className="break-all font-mono text-xs">
                    {quote.signatureUserAgent}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cycle de vie</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-muted-foreground">Créé le</dt>
            <dd>{formatDateTime(quote.createdAt)}</dd>
            <dt className="text-muted-foreground">Envoyé le</dt>
            <dd>{formatDateTime(quote.sentAt)}</dd>
            <dt className="text-muted-foreground">Accepté le</dt>
            <dd>{formatDateTime(quote.acceptedAt)}</dd>
            <dt className="text-muted-foreground">Refusé le</dt>
            <dd>{formatDateTime(quote.rejectedAt)}</dd>
            <dt className="text-muted-foreground">Expire le</dt>
            <dd>{formatDateTime(quote.expiresAt)}</dd>
            {quote.clientId && (
              <>
                <dt className="text-muted-foreground">Client lié</dt>
                <dd>
                  <Link
                    href={`/admin/clients/${quote.clientId}`}
                    className="underline hover:text-primary"
                  >
                    Voir la fiche client
                  </Link>
                </dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
