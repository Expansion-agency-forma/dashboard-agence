"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Check,
  ExternalLink,
  GraduationCap,
  Loader2,
  Pencil,
  Receipt,
} from "lucide-react"
import {
  setFormationDaysAction,
  setFormationTravelAction,
} from "./tasks-actions"
import { issueFormationInvoiceAction } from "./stripe-actions"
import {
  formationPriceCents,
  formatEuros,
  parseEurosToCents,
} from "@/lib/pricing"

type Props = {
  clientId: string
  initialDays: number | null
  initialTravelCents: number | null
  hasFormationInvoice: boolean
}

const centsToEurosString = (cents: number | null): string =>
  cents && cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : ""

export function FormationPricingCard({
  clientId,
  initialDays,
  initialTravelCents,
  hasFormationInvoice,
}: Props) {
  const [currentDays, setCurrentDays] = useState<number | null>(initialDays)
  const [currentTravelCents, setCurrentTravelCents] = useState<number | null>(
    initialTravelCents,
  )
  const [editing, setEditing] = useState(initialDays === null)
  const [daysValue, setDaysValue] = useState(
    initialDays !== null ? String(initialDays) : "",
  )
  const [travelValue, setTravelValue] = useState(
    centsToEurosString(initialTravelCents),
  )
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issuing, startIssue] = useTransition()
  const [issueResult, setIssueResult] = useState<string | null>(null)
  const [issued, setIssued] = useState(hasFormationInvoice)
  const [issueError, setIssueError] = useState<string | null>(null)

  const parsedDraftDays = (() => {
    const n = Number(daysValue)
    return Number.isInteger(n) && n >= 1 ? n : null
  })()
  const parsedDraftTravel = travelValue.trim()
    ? parseEurosToCents(travelValue)
    : 0 // empty input = no travel fee

  const save = () => {
    setError(null)
    if (parsedDraftDays === null) {
      setError("Saisis un nombre entier de jours (1 ou plus).")
      return
    }
    if (parsedDraftTravel === null) {
      setError("Montant de déplacement invalide (ex. 100 ou 100,50).")
      return
    }
    startTransition(async () => {
      try {
        await setFormationDaysAction(clientId, parsedDraftDays)
        await setFormationTravelAction(
          clientId,
          parsedDraftTravel > 0 ? parsedDraftTravel : null,
        )
        setCurrentDays(parsedDraftDays)
        setCurrentTravelCents(parsedDraftTravel > 0 ? parsedDraftTravel : null)
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  const clear = () => {
    startTransition(async () => {
      try {
        await setFormationDaysAction(clientId, null)
        await setFormationTravelAction(clientId, null)
        setCurrentDays(null)
        setCurrentTravelCents(null)
        setDaysValue("")
        setTravelValue("")
        setEditing(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  const issue = () => {
    setIssueError(null)
    setIssueResult(null)
    startIssue(async () => {
      try {
        const res = await issueFormationInvoiceAction(clientId)
        setIssueResult(res.hostedUrl)
        setIssued(true)
      } catch (err) {
        setIssueError(err instanceof Error ? err.message : "Erreur d'émission")
      }
    })
  }

  const draftFormationCents =
    parsedDraftDays !== null ? formationPriceCents(parsedDraftDays) : null
  const draftTravelCents = parsedDraftTravel ?? 0
  const draftTotalCents =
    draftFormationCents !== null ? draftFormationCents + draftTravelCents : null

  const currentFormationCents =
    currentDays !== null ? formationPriceCents(currentDays) : null
  const currentTotalCents =
    currentFormationCents !== null
      ? currentFormationCents + (currentTravelCents ?? 0)
      : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap size={16} className="text-[var(--brand-gold)]" />
            Tarif formation
          </CardTitle>
          <CardDescription>
            2 000 € pour 1 jour, 3 000 € pour 2 jours, puis +500 € par jour
            supplémentaire. Frais de déplacement facturables en sus.
          </CardDescription>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} /> Enregistré
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!editing && currentDays !== null ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  <span className="brand-italic text-[var(--brand-gold)]">
                    {currentTotalCents !== null
                      ? formatEuros(currentTotalCents)
                      : "—"}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentDays} jour{currentDays > 1 ? "s" : ""} de tournage
                  {currentFormationCents !== null && (
                    <> · {formatEuros(currentFormationCents)}</>
                  )}
                  {currentTravelCents && currentTravelCents > 0 && (
                    <>
                      {" "}+ déplacement {formatEuros(currentTravelCents)}
                    </>
                  )}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDaysValue(String(currentDays))
                    setTravelValue(centsToEurosString(currentTravelCents))
                    setEditing(true)
                  }}
                  disabled={pending || issuing}
                >
                  <Pencil size={12} />
                  Modifier
                </Button>
                {!issued && (
                  <Button size="sm" onClick={issue} disabled={issuing || pending}>
                    {issuing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Receipt size={12} />
                    )}
                    Émettre la facture
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clear}
                  disabled={pending || issuing}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Retirer
                </Button>
              </div>
            </div>
            {issued && !issueResult && (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                Facture déjà émise pour ce client.
              </p>
            )}
            {issueResult !== null && (
              <p className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <Check size={14} />
                Facture émise et envoyée par email.
                {issueResult && (
                  <a
                    href={issueResult}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 underline"
                  >
                    <ExternalLink size={12} />
                    Voir sur Stripe
                  </a>
                )}
              </p>
            )}
            {issueError && (
              <p className="text-sm text-destructive" role="alert">
                {issueError}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="formation-days">Nombre de jours de tournage</Label>
                <Input
                  id="formation-days"
                  type="number"
                  min={1}
                  step={1}
                  value={daysValue}
                  onChange={(e) => setDaysValue(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formation-travel">
                  Frais de déplacement (€){" "}
                  <span className="text-muted-foreground">(facultatif)</span>
                </Label>
                <Input
                  id="formation-travel"
                  value={travelValue}
                  onChange={(e) => setTravelValue(e.target.value)}
                  placeholder="Ex. 100 ou 100,50"
                  inputMode="decimal"
                />
              </div>
            </div>

            {draftFormationCents !== null && (
              <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  Formation :{" "}
                  <span className="font-semibold text-foreground">
                    {formatEuros(draftFormationCents)}
                  </span>
                  {draftTravelCents > 0 && (
                    <>
                      {" "}+ déplacement{" "}
                      <span className="font-semibold text-foreground">
                        {formatEuros(draftTravelCents)}
                      </span>
                    </>
                  )}
                  {" "}= total{" "}
                  <span className="font-semibold text-[var(--brand-gold)]">
                    {formatEuros(draftTotalCents ?? 0)}
                  </span>
                </p>
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={pending || !parsedDraftDays}>
                {pending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                Enregistrer
              </Button>
              {currentDays !== null && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDaysValue(String(currentDays))
                    setTravelValue(centsToEurosString(currentTravelCents))
                    setEditing(false)
                    setError(null)
                  }}
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
