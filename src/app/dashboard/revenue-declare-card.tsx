"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Check, Euro, Loader2 } from "lucide-react"
import {
  currentPeriodMonth,
  formatEuros,
  formatPeriodMonth,
  parseEurosToCents,
  pubInvoiceCents,
} from "@/lib/pricing"
import { declarePubRevenueAction } from "./revenue-actions"

type Declaration = {
  id: string
  periodMonth: string
  declaredRevenueCents: number | null
  validatedRevenueCents: number | null
  status: "pending" | "declared" | "validated" | "invoiced"
}

type Props = {
  clientId: string
  declarations: Declaration[]
}

const statusStyle: Record<Declaration["status"], string> = {
  pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  declared: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  validated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  invoiced: "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] text-[var(--brand-gold)]",
}
const statusLabel: Record<Declaration["status"], string> = {
  pending: "À déclarer",
  declared: "Envoyé, en attente de validation",
  validated: "Validé par l'agence",
  invoiced: "Facturé",
}

export function RevenueDeclareCard({ clientId, declarations }: Props) {
  const period = currentPeriodMonth()
  const previous = declarations.find((d) => d.periodMonth === period)
  const isLocked =
    previous?.status === "validated" || previous?.status === "invoiced"

  const initialValue =
    previous?.declaredRevenueCents !== null && previous?.declaredRevenueCents !== undefined
      ? (previous.declaredRevenueCents / 100).toFixed(2).replace(".", ",")
      : ""

  const [value, setValue] = useState(initialValue)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedCents = parseEurosToCents(value)
  const previewInvoice = parsedCents !== null ? pubInvoiceCents(parsedCents) : null

  const submit = () => {
    setError(null)
    if (parsedCents === null) {
      setError("Saisis un montant valide (ex. 8500 ou 8500,50).")
      return
    }
    startTransition(async () => {
      try {
        await declarePubRevenueAction({
          clientId,
          periodMonth: period,
          revenueCents: parsedCents,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur — réessayez")
      }
    })
  }

  const history = declarations
    .filter((d) => d.periodMonth !== period)
    .slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Euro size={16} className="text-[var(--brand-gold)]" />
          Mon chiffre d&apos;affaires
        </CardTitle>
        <CardDescription>
          Chaque mois, déclarez le CA généré grâce à la pub. Votre facture
          correspond à 20 % de ce montant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <p className="text-sm font-medium first-letter:uppercase">
            {formatPeriodMonth(period)}
          </p>
          {isLocked ? (
            <div className="mt-3 space-y-1">
              <Badge
                variant="outline"
                className={statusStyle[previous!.status]}
              >
                {statusLabel[previous!.status]}
              </Badge>
              <p className="text-sm text-muted-foreground">
                CA validé :{" "}
                <span className="font-semibold text-foreground">
                  {previous?.validatedRevenueCents !== null &&
                  previous?.validatedRevenueCents !== undefined
                    ? formatEuros(previous.validatedRevenueCents)
                    : "—"}
                </span>
                {" "}· Facture (20 %) :{" "}
                <span className="font-semibold text-[var(--brand-gold)]">
                  {previous?.validatedRevenueCents !== null &&
                  previous?.validatedRevenueCents !== undefined
                    ? formatEuros(pubInvoiceCents(previous.validatedRevenueCents))
                    : "—"}
                </span>
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="revenue-input">CA du mois (€)</Label>
                <Input
                  id="revenue-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Ex. 8500 ou 8500,50"
                  inputMode="decimal"
                  className="text-lg"
                />
              </div>
              {previewInvoice !== null && (
                <p className="text-sm text-muted-foreground">
                  Votre facture sera de{" "}
                  <span className="font-semibold text-[var(--brand-gold)]">
                    {formatEuros(previewInvoice)}
                  </span>{" "}
                  (20 %)
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={submit} disabled={pending}>
                  {pending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {previous ? "Mettre à jour" : "Déclarer"}
                </Button>
                {previous?.status === "declared" && (
                  <Badge
                    variant="outline"
                    className={statusStyle.declared}
                  >
                    {statusLabel.declared}
                  </Badge>
                )}
                {saved && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    Enregistré
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Historique
            </h3>
            <ul className="space-y-2">
              {history.map((d) => {
                const amount =
                  d.validatedRevenueCents !== null
                    ? d.validatedRevenueCents
                    : d.declaredRevenueCents
                const invoice = amount !== null ? pubInvoiceCents(amount) : null
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card/40 p-3 text-sm"
                  >
                    <span className="font-medium first-letter:uppercase">
                      {formatPeriodMonth(d.periodMonth)}
                    </span>
                    <span className="text-muted-foreground">
                      CA :{" "}
                      <span className="font-semibold text-foreground">
                        {amount !== null ? formatEuros(amount) : "—"}
                      </span>
                      {invoice !== null && (
                        <>
                          {" "}· Facture :{" "}
                          <span className="font-semibold text-[var(--brand-gold)]">
                            {formatEuros(invoice)}
                          </span>
                        </>
                      )}
                    </span>
                    <Badge variant="outline" className={statusStyle[d.status]}>
                      {statusLabel[d.status]}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
