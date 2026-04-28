"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { GraduationCap, Loader2, Megaphone } from "lucide-react"
import { createQuoteAction } from "../actions"
import {
  formationPriceCents,
  formationProfitability,
  formatEuros,
  parseEurosToCents,
  PROFITABILITY_TIERS_CENTS,
  pubInvoiceCents,
} from "@/lib/pricing"

export function NewQuoteForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [domain, setDomain] = useState("")
  const [siret, setSiret] = useState("")
  const [pubChecked, setPubChecked] = useState(true)
  const [formationChecked, setFormationChecked] = useState(false)
  const [pubRevenueEuros, setPubRevenueEuros] = useState("")
  const [formationDays, setFormationDays] = useState("")
  const [travelEuros, setTravelEuros] = useState("")
  const [notes, setNotes] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("7")

  const services: ("pub" | "formation")[] = []
  if (pubChecked) services.push("pub")
  if (formationChecked) services.push("formation")

  const noneSelected = services.length === 0

  const parsedFormationDays = (() => {
    const n = Number(formationDays)
    return Number.isInteger(n) && n >= 1 ? n : null
  })()
  const parsedTravelCents = travelEuros.trim()
    ? parseEurosToCents(travelEuros)
    : 0
  const parsedPubRevenueCents = pubRevenueEuros.trim()
    ? parseEurosToCents(pubRevenueEuros)
    : null

  const formationCents = parsedFormationDays
    ? formationPriceCents(parsedFormationDays)
    : null
  const formationTotalCents =
    formationCents !== null ? formationCents + (parsedTravelCents ?? 0) : null
  const profitabilityTiers =
    formationTotalCents && formationChecked
      ? formationProfitability(formationTotalCents, PROFITABILITY_TIERS_CENTS)
      : null

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Le nom du prospect est requis.")
      return
    }
    if (!email.trim()) {
      setError("L'email du prospect est requis.")
      return
    }
    if (siret.trim() && !/^\d{14}$/.test(siret.trim())) {
      setError("Le SIRET doit comporter exactement 14 chiffres.")
      return
    }
    if (services.length === 0) {
      setError("Sélectionne au moins une prestation.")
      return
    }
    if (formationChecked && parsedFormationDays === null) {
      setError("Saisis un nombre entier de jours de tournage (≥ 1).")
      return
    }
    if (formationChecked && parsedTravelCents === null) {
      setError("Montant de déplacement invalide.")
      return
    }
    if (pubChecked && pubRevenueEuros.trim() && parsedPubRevenueCents === null) {
      setError("Estimation de CA pub invalide.")
      return
    }
    const exp = Number(expiresInDays)
    if (!Number.isInteger(exp) || exp < 1 || exp > 90) {
      setError("Durée d'expiration invalide (1 à 90 jours).")
      return
    }

    startTransition(async () => {
      try {
        await createQuoteAction({
          prospectName: name.trim(),
          prospectEmail: email.trim(),
          prospectCompany: company.trim() || null,
          prospectDomain: domain.trim() || null,
          prospectSiret: siret.trim() || null,
          services,
          pubExpectedMonthlyRevenueCents: pubChecked
            ? parsedPubRevenueCents ?? null
            : null,
          formationDays: formationChecked ? parsedFormationDays : null,
          formationTravelCents:
            formationChecked && parsedTravelCents && parsedTravelCents > 0
              ? parsedTravelCents
              : null,
          notes: notes.trim() || null,
          expiresInDays: exp,
        })
        // The action redirects on success, so we usually never reach here.
      } catch (err) {
        // Next.js redirect throws an error type we should ignore
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return
        setError(err instanceof Error ? err.message : "Erreur — réessayez")
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Prospect
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="q-name">Nom complet</Label>
            <Input
              id="q-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nathalie Martin"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-email">Email</Label>
            <Input
              id="q-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nathalie@exemple.com"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-company">
            Société / institut{" "}
            <span className="text-muted-foreground">(facultatif)</span>
          </Label>
          <Input
            id="q-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Institut Beauté SARL"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="q-domain">
              Domaine d&apos;activité{" "}
              <span className="text-muted-foreground">(facultatif)</span>
            </Label>
            <Input
              id="q-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Ex. Beauté, Coach sportif, Consulting B2B"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-siret">
              SIRET <span className="text-muted-foreground">(facultatif)</span>
            </Label>
            <Input
              id="q-siret"
              value={siret}
              onChange={(e) => setSiret(e.target.value.replace(/\s/g, ""))}
              placeholder="14 chiffres"
              inputMode="numeric"
              maxLength={14}
              className="font-mono"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Prestations
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            htmlFor="svc-pub"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              pubChecked
                ? "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)]"
                : "border-border hover:border-[var(--brand-gold-border)]/60"
            }`}
          >
            <Checkbox
              id="svc-pub"
              checked={pubChecked}
              onCheckedChange={(v) => setPubChecked(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Megaphone
                  size={16}
                  className={
                    pubChecked
                      ? "text-[var(--brand-gold)]"
                      : "text-muted-foreground"
                  }
                />
                <span className="font-medium">Publicité</span>
              </div>
              <p className="text-xs text-muted-foreground">
                20 % du CA mensuel généré grâce à la pub.
              </p>
            </div>
          </label>
          <label
            htmlFor="svc-formation"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              formationChecked
                ? "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)]"
                : "border-border hover:border-[var(--brand-gold-border)]/60"
            }`}
          >
            <Checkbox
              id="svc-formation"
              checked={formationChecked}
              onCheckedChange={(v) => setFormationChecked(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <GraduationCap
                  size={16}
                  className={
                    formationChecked
                      ? "text-[var(--brand-gold)]"
                      : "text-muted-foreground"
                  }
                />
                <span className="font-medium">Formation en ligne</span>
              </div>
              <p className="text-xs text-muted-foreground">
                2 000 € / 1 jour, 3 000 € / 2 jours, +500 € / jour suppl.
              </p>
            </div>
          </label>
        </div>
      </section>

      {pubChecked && (
        <section className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
          <h3 className="text-sm font-semibold">Pub — estimation</h3>
          <div className="space-y-1.5">
            <Label htmlFor="pub-revenue">
              Estimation du CA mensuel attendu (€){" "}
              <span className="text-muted-foreground">(facultatif)</span>
            </Label>
            <Input
              id="pub-revenue"
              value={pubRevenueEuros}
              onChange={(e) => setPubRevenueEuros(e.target.value)}
              placeholder="Ex. 5000"
              inputMode="decimal"
            />
            {parsedPubRevenueCents !== null && parsedPubRevenueCents > 0 && (
              <p className="text-xs text-muted-foreground">
                Le devis montrera : facture mensuelle estimée de{" "}
                <span className="font-semibold text-foreground">
                  {formatEuros(pubInvoiceCents(parsedPubRevenueCents))}
                </span>
                {" "}/ mois.
              </p>
            )}
          </div>
        </section>
      )}

      {formationChecked && (
        <section className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
          <h3 className="text-sm font-semibold">Formation</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-days">Nombre de jours de tournage</Label>
              <Input
                id="f-days"
                type="number"
                min={1}
                step={1}
                value={formationDays}
                onChange={(e) => setFormationDays(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-travel">
                Frais de déplacement (€){" "}
                <span className="text-muted-foreground">(facultatif)</span>
              </Label>
              <Input
                id="f-travel"
                value={travelEuros}
                onChange={(e) => setTravelEuros(e.target.value)}
                placeholder="Ex. 100"
                inputMode="decimal"
              />
            </div>
          </div>

          {formationTotalCents !== null && (
            <div className="space-y-2 rounded-md border border-border bg-background/40 p-3 text-sm">
              <p className="text-muted-foreground">
                Total formation :{" "}
                <span className="font-semibold text-foreground">
                  {formatEuros(formationCents ?? 0)}
                </span>
                {parsedTravelCents && parsedTravelCents > 0 && (
                  <>
                    {" "}+ déplacement{" "}
                    <span className="font-semibold text-foreground">
                      {formatEuros(parsedTravelCents)}
                    </span>
                  </>
                )}
                {" "}={" "}
                <span className="font-semibold text-[var(--brand-gold)]">
                  {formatEuros(formationTotalCents)}
                </span>
              </p>
              {profitabilityTiers && profitabilityTiers.length > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Rentabilité (apparaîtra sur le devis)
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {profitabilityTiers.map((t) => (
                      <li key={t.sellPriceCents}>
                        À{" "}
                        <span className="font-semibold text-foreground">
                          {formatEuros(t.sellPriceCents)}
                        </span>
                        {" "}/ formation vendue → il faut en vendre{" "}
                        <span className="font-semibold text-foreground">
                          {t.salesNeeded}
                        </span>
                        {" "}pour rentabiliser.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="q-notes">
          Notes / personnalisation{" "}
          <span className="text-muted-foreground">(facultatif)</span>
        </Label>
        <Textarea
          id="q-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Détails sur le scope, conditions particulières…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-expires">Validité (jours)</Label>
        <Input
          id="q-expires"
          type="number"
          min={1}
          max={90}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          className="w-32"
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || noneSelected}>
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          Créer le devis
        </Button>
      </div>
    </form>
  )
}
