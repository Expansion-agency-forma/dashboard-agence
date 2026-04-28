"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Check, CheckCircle2, ExternalLink, Loader2, Receipt, Undo2 } from "lucide-react"
import {
  formatEuros,
  formatPeriodMonth,
  parseEurosToCents,
  pubInvoiceCents,
} from "@/lib/pricing"
import {
  unvalidatePubRevenueAction,
  validatePubRevenueAction,
} from "./tasks-actions"
import { issuePubInvoiceAction } from "./stripe-actions"

type Declaration = {
  id: string
  periodMonth: string
  declaredRevenueCents: number | null
  declaredAt: Date | null
  validatedRevenueCents: number | null
  validatedAt: Date | null
  notes: string | null
  status: "pending" | "declared" | "validated" | "invoiced"
}

type Props = {
  declarations: Declaration[]
}

const statusStyle: Record<Declaration["status"], string> = {
  pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  declared: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  validated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  invoiced: "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] text-[var(--brand-gold)]",
}
const statusLabel: Record<Declaration["status"], string> = {
  pending: "En attente",
  declared: "À valider",
  validated: "Validé",
  invoiced: "Facturé",
}

function formatDateTime(d: Date | null): string {
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function RevenuePanel({ declarations }: Props) {
  if (declarations.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Aucune déclaration de CA pour le moment. Le client doit déclarer son CA
        mensuel depuis son dashboard.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {declarations.map((d) => (
        <DeclarationRow key={d.id} declaration={d} />
      ))}
    </ul>
  )
}

function DeclarationRow({ declaration }: { declaration: Declaration }) {
  const [editing, setEditing] = useState(false)
  const [overrideEuros, setOverrideEuros] = useState(
    declaration.validatedRevenueCents !== null
      ? (declaration.validatedRevenueCents / 100).toFixed(2).replace(".", ",")
      : declaration.declaredRevenueCents !== null
        ? (declaration.declaredRevenueCents / 100).toFixed(2).replace(".", ",")
        : "",
  )
  const [notes, setNotes] = useState(declaration.notes ?? "")
  const [pending, startTransition] = useTransition()
  const [issuing, startIssue] = useTransition()
  const [issueResult, setIssueResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsedCents = parseEurosToCents(overrideEuros)
  const computedInvoice = parsedCents !== null ? pubInvoiceCents(parsedCents) : null

  const validate = () => {
    setError(null)
    if (parsedCents === null) {
      setError("Montant invalide.")
      return
    }
    startTransition(async () => {
      try {
        await validatePubRevenueAction({
          declarationId: declaration.id,
          validatedRevenueCents: parsedCents,
          notes: notes.trim() || null,
        })
        setEditing(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  const unvalidate = () => {
    setError(null)
    startTransition(async () => {
      try {
        await unvalidatePubRevenueAction(declaration.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  const issue = () => {
    setError(null)
    setIssueResult(null)
    startIssue(async () => {
      try {
        const res = await issuePubInvoiceAction(declaration.id)
        setIssueResult(res.hostedUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur d'émission")
      }
    })
  }

  const declaredCents = declaration.declaredRevenueCents
  const validatedCents = declaration.validatedRevenueCents
  const invoiceCents =
    validatedCents !== null
      ? pubInvoiceCents(validatedCents)
      : declaredCents !== null
        ? pubInvoiceCents(declaredCents)
        : null

  return (
    <li className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium first-letter:uppercase">
            {formatPeriodMonth(declaration.periodMonth)}
          </p>
          <p className="text-xs text-muted-foreground">
            CA déclaré :{" "}
            <span className="font-semibold text-foreground">
              {declaredCents !== null ? formatEuros(declaredCents) : "—"}
            </span>
            {declaration.declaredAt && (
              <> · le {formatDateTime(declaration.declaredAt)}</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Facture (20 %) :{" "}
            <span className="font-semibold text-[var(--brand-gold)]">
              {invoiceCents !== null ? formatEuros(invoiceCents) : "—"}
            </span>
            {validatedCents !== null && validatedCents !== declaredCents && (
              <>
                {" "}· basée sur un CA validé de{" "}
                <span className="font-semibold text-foreground">
                  {formatEuros(validatedCents)}
                </span>
              </>
            )}
          </p>
          {declaration.notes && (
            <p className="mt-1 text-xs text-muted-foreground">
              Note : {declaration.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusStyle[declaration.status]}>
            {statusLabel[declaration.status]}
          </Badge>
          {declaration.status === "validated" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={unvalidate}
                disabled={pending || issuing}
                className="text-muted-foreground"
              >
                <Undo2 size={12} />
                Rouvrir
              </Button>
              <Button
                size="sm"
                onClick={issue}
                disabled={issuing || pending}
              >
                {issuing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Receipt size={12} />
                )}
                Émettre la facture
              </Button>
            </>
          )}
          {declaration.status === "declared" && !editing && (
            <Button size="sm" onClick={() => setEditing(true)} disabled={pending}>
              <CheckCircle2 size={12} />
              Valider
            </Button>
          )}
        </div>
      </div>

      {issueResult !== null && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
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

      {editing && (
        <div className="mt-4 space-y-3 rounded-md border border-border bg-background/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`override-${declaration.id}`}>
              CA validé (€) — modifie si nécessaire
            </Label>
            <Input
              id={`override-${declaration.id}`}
              value={overrideEuros}
              onChange={(e) => setOverrideEuros(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
            {computedInvoice !== null && (
              <p className="text-xs text-muted-foreground">
                Facture qui sera émise (20 %) :{" "}
                <span className="font-semibold text-foreground">
                  {formatEuros(computedInvoice)}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${declaration.id}`}>
              Note interne <span className="text-muted-foreground">(facultatif)</span>
            </Label>
            <Textarea
              id={`notes-${declaration.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Justification d'un ajustement, etc."
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={validate} disabled={pending}>
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Confirmer la validation
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              disabled={pending}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
