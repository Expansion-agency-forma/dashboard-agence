"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Pencil,
  UserPlus,
} from "lucide-react"
import { updateAdAccountAction } from "./tasks-actions"

type Props = {
  clientId: string
  preference: "invite" | "create" | null
  inviteConfirmedAt: Date | null
  initialCreatedAt: Date | null
  initialName: string | null
  cardConfirmedAt: Date | null
}

type Phase =
  | { state: "idle" }
  | { state: "asking-name" }
  | { state: "asking-card"; nameDraft: string }

export function AdAccountCard({
  clientId,
  preference,
  inviteConfirmedAt,
  initialCreatedAt,
  initialName,
  cardConfirmedAt,
}: Props) {
  const [hasAccess, setHasAccess] = useState(Boolean(initialCreatedAt))
  const [phase, setPhase] = useState<Phase>({ state: "idle" })
  const [name, setName] = useState(initialName ?? "")
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const persist = (args: {
    hasAccess: boolean
    name?: string | null
    cardAlreadyOnAccount?: boolean
  }) => {
    startTransition(async () => {
      try {
        await updateAdAccountAction(clientId, args)
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
        setPhase({ state: "idle" })
      } catch (err) {
        console.error(err)
      }
    })
  }

  const onToggle = (value: boolean) => {
    setHasAccess(value)
    if (!value) {
      setName("")
      persist({ hasAccess: false })
    } else if (initialName) {
      // Already have a name — just confirm access toggle (keep existing state)
      setPhase({ state: "idle" })
    } else {
      setPhase({ state: "asking-name" })
    }
  }

  const confirmName = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setPhase({ state: "asking-card", nameDraft: trimmed })
  }

  const answerCard = (alreadyOnAccount: boolean) => {
    const finalName =
      phase.state === "asking-card" ? phase.nameDraft : name.trim() || initialName || ""
    if (!finalName) return
    persist({
      hasAccess: true,
      name: finalName,
      cardAlreadyOnAccount: alreadyOnAccount,
    })
  }

  const renameAction = () => {
    setPhase({ state: "asking-name" })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} className="text-[var(--brand-gold)]" />
            Compte publicitaire
          </CardTitle>
          <CardDescription>
            Statut du compte ads et de la carte bancaire côté client.
          </CardDescription>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} /> Enregistré
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client's choice during onboarding */}
        {preference && (
          <div className="rounded-md border border-border bg-card/40 p-3 text-sm">
            {preference === "invite" ? (
              <div className="flex items-start gap-2">
                <UserPlus
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                />
                <div className="flex-1">
                  <p className="font-medium">
                    Le client invite Expansion sur son compte existant
                  </p>
                  {inviteConfirmedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Invitation envoyée le{" "}
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(inviteConfirmedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Choix fait — en attente de confirmation d&apos;envoi
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CreditCard
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                />
                <div className="flex-1">
                  <p className="font-medium">
                    Le client demande à Expansion de créer le compte
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Identifiants FB / IG déposés par le client — voir l&apos;onglet Accès.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card/40 p-3">
          <Checkbox
            checked={hasAccess}
            onCheckedChange={(v) => onToggle(v === true)}
            disabled={pending || phase.state !== "idle"}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium">J&apos;ai accès au compte publicitaire</p>
            <p className="text-xs text-muted-foreground">
              Coche une fois que tu peux ouvrir le compte ads (invité par le
              client ou créé par toi).
            </p>
          </div>
        </label>

        {hasAccess && phase.state === "asking-name" && (
          <div className="space-y-2 rounded-md border border-border bg-card/40 p-4">
            <Label htmlFor="ad-account-name">Nom du compte publicitaire</Label>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                id="ad-account-name"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. act_1234567890 · Nom-Entreprise-Meta"
                className="flex-1 min-w-[220px]"
              />
              <Button size="sm" onClick={confirmName} disabled={!name.trim()}>
                Continuer
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ce nom sera affiché au client si on doit lui demander d&apos;ajouter
              sa carte.
            </p>
          </div>
        )}

        {hasAccess && phase.state === "asking-card" && (
          <div className="space-y-3 rounded-md border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-4">
            <p className="text-sm font-semibold">
              La carte bleue est-elle déjà sur le compte ?
            </p>
            <p className="text-xs text-muted-foreground">
              Si le client a invité Expansion, sa carte est souvent déjà
              enregistrée. Sinon, on lui demande de l&apos;ajouter via un popup.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => answerCard(true)}
                disabled={pending}
              >
                {pending ? <Loader2 size={12} className="animate-spin" /> : null}
                Oui — carte déjà ajoutée
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => answerCard(false)}
                disabled={pending}
              >
                Non — demander au client
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPhase({ state: "asking-name" })}
              >
                Modifier le nom
              </Button>
            </div>
          </div>
        )}

        {hasAccess && phase.state === "idle" && initialName && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-3">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Nom du compte
              </p>
              <p className="text-sm font-medium">{initialName}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={renameAction}
              disabled={pending}
            >
              <Pencil size={12} />
              Modifier
            </Button>
          </div>
        )}

        {hasAccess && phase.state === "idle" && initialName && (
          <div className="rounded-md border border-border bg-card/40 p-3">
            {cardConfirmedAt ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
                Carte ajoutée le{" "}
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(cardConfirmedAt)}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  En attente client
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Le client verra le popup carte à sa prochaine connexion.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
