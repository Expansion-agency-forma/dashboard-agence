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
import { Check, FileText, Loader2, Pencil, Zap } from "lucide-react"
import { updateBillingAction } from "./tasks-actions"
import { syncStripeCustomerAction } from "./stripe-actions"

type Billing = {
  billingName: string | null
  billingAddressLine1: string | null
  billingAddressLine2: string | null
  billingPostalCode: string | null
  billingCity: string | null
  billingCountry: string | null
  siret: string | null
}

type Props = {
  clientId: string
  initial: Billing
  stripeCustomerId: string | null
}

const isComplete = (b: Billing) =>
  Boolean(
    b.billingName &&
      b.billingAddressLine1 &&
      b.billingPostalCode &&
      b.billingCity &&
      b.siret,
  )

export function BillingCard({ clientId, initial, stripeCustomerId }: Props) {
  const [current, setCurrent] = useState<Billing>(initial)
  const [editing, setEditing] = useState<boolean>(!isComplete(initial))
  const [draft, setDraft] = useState<Billing>(initial)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncedCustomerId, setSyncedCustomerId] = useState<string | null>(
    stripeCustomerId,
  )
  const [syncing, startSync] = useTransition()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const sync = () => {
    setSyncError(null)
    setSyncMsg(null)
    startSync(async () => {
      try {
        const res = await syncStripeCustomerAction(clientId)
        setSyncedCustomerId(res.customerId)
        setSyncMsg(
          stripeCustomerId
            ? "Client mis à jour sur Stripe."
            : "Client créé sur Stripe.",
        )
        setTimeout(() => setSyncMsg(null), 3500)
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Erreur de sync")
      }
    })
  }

  const save = () => {
    setError(null)
    if (draft.siret && !/^\d{14}$/.test(draft.siret)) {
      setError("Le SIRET doit comporter exactement 14 chiffres.")
      return
    }
    startTransition(async () => {
      try {
        await updateBillingAction(clientId, draft)
        setCurrent(draft)
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erreur lors de l'enregistrement",
        )
      }
    })
  }

  const cancel = () => {
    setDraft(current)
    setError(null)
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText size={16} className="text-[var(--brand-gold)]" />
            Coordonnées de facturation
          </CardTitle>
          <CardDescription>
            Utilisées pour émettre les factures mensuelles via Stripe.
          </CardDescription>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} /> Enregistré
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">{current.billingName ?? "—"}</p>
                <p className="text-muted-foreground">
                  {current.billingAddressLine1 ?? "—"}
                  {current.billingAddressLine2 ? `, ${current.billingAddressLine2}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {[current.billingPostalCode, current.billingCity]
                    .filter(Boolean)
                    .join(" ") || "—"}
                  {current.billingCountry && current.billingCountry !== "FR"
                    ? ` · ${current.billingCountry}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  SIRET : <span className="font-mono">{current.siret ?? "—"}</span>
                </p>
              </div>
              <div className="ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  disabled={pending}
                >
                  <Pencil size={12} />
                  Modifier
                </Button>
              </div>
            </div>

            {isComplete(current) && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/40 px-3 py-2">
                <div className="text-xs">
                  <p className="font-medium">Stripe</p>
                  <p className="text-muted-foreground">
                    {syncedCustomerId ? (
                      <>
                        Client lié :{" "}
                        <span className="font-mono">{syncedCustomerId}</span>
                      </>
                    ) : (
                      "Pas encore synchronisé."
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sync}
                  disabled={syncing}
                  className="ml-auto"
                >
                  {syncing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Zap size={12} />
                  )}
                  {syncedCustomerId ? "Resynchroniser" : "Créer sur Stripe"}
                </Button>
              </div>
            )}
            {syncMsg && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {syncMsg}
              </p>
            )}
            {syncError && (
              <p className="text-sm text-destructive" role="alert">
                {syncError}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="billing-name">Nom de l&apos;institut / société</Label>
              <Input
                id="billing-name"
                value={draft.billingName ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, billingName: e.target.value })
                }
                placeholder="Ex. Institut Beauté SARL"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-line1">Adresse</Label>
              <Input
                id="billing-line1"
                value={draft.billingAddressLine1 ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, billingAddressLine1: e.target.value })
                }
                placeholder="12 rue des Lilas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-line2">
                Complément <span className="text-muted-foreground">(facultatif)</span>
              </Label>
              <Input
                id="billing-line2"
                value={draft.billingAddressLine2 ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, billingAddressLine2: e.target.value })
                }
                placeholder="Bât. A, étage 2"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="billing-postal">Code postal</Label>
                <Input
                  id="billing-postal"
                  value={draft.billingPostalCode ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, billingPostalCode: e.target.value })
                  }
                  placeholder="75001"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="billing-city">Ville</Label>
                <Input
                  id="billing-city"
                  value={draft.billingCity ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, billingCity: e.target.value })
                  }
                  placeholder="Paris"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-siret">SIRET</Label>
              <Input
                id="billing-siret"
                value={draft.siret ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, siret: e.target.value.replace(/\s/g, "") })
                }
                placeholder="14 chiffres"
                inputMode="numeric"
                maxLength={14}
                className="font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? <Loader2 size={12} className="animate-spin" /> : null}
                Enregistrer
              </Button>
              {isComplete(current) && (
                <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
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
