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
import { Check, CheckCircle2, CreditCard, Loader2, Pencil } from "lucide-react"
import { updateAdAccountAction } from "./tasks-actions"

type Props = {
  clientId: string
  initialCreatedAt: Date | null
  initialName: string | null
  cardConfirmedAt: Date | null
}

export function AdAccountCard({
  clientId,
  initialCreatedAt,
  initialName,
  cardConfirmedAt,
}: Props) {
  const [created, setCreated] = useState(Boolean(initialCreatedAt))
  const [name, setName] = useState(initialName ?? "")
  const [editing, setEditing] = useState(!initialCreatedAt)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const persist = (nextCreated: boolean, nextName: string) => {
    startTransition(async () => {
      try {
        await updateAdAccountAction(clientId, {
          created: nextCreated,
          name: nextCreated ? nextName : null,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
        if (nextCreated) setEditing(false)
      } catch (err) {
        console.error(err)
      }
    })
  }

  const onToggle = (value: boolean) => {
    setCreated(value)
    if (!value) {
      setName("")
      setEditing(true)
      persist(false, "")
    } else {
      // Just flip the local state; user still needs to type the name + save
      setEditing(true)
    }
  }

  const onSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    persist(true, trimmed)
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
            Dès que tu coches « créé », le client reçoit un popup pour ajouter sa
            carte au compte.
          </CardDescription>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} /> Enregistré
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card/40 p-3">
          <Checkbox
            checked={created}
            onCheckedChange={(v) => onToggle(v === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium">Compte publicitaire créé</p>
            <p className="text-xs text-muted-foreground">
              Coche une fois que le compte ads (Meta, TikTok, etc.) est prêt côté plateforme.
            </p>
          </div>
        </label>

        {created && (editing || !initialName) ? (
          <div className="space-y-2">
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
              <Button size="sm" onClick={onSave} disabled={pending || !name.trim()}>
                {pending ? <Loader2 size={12} className="animate-spin" /> : null}
                Enregistrer
              </Button>
              {initialName && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setName(initialName)
                    setEditing(false)
                  }}
                >
                  Annuler
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Ce nom sera affiché au client pour qu&apos;il sache sur quel compte
              ajouter sa carte.
            </p>
          </div>
        ) : created && initialName ? (
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
              onClick={() => {
                setName(initialName)
                setEditing(true)
              }}
              disabled={pending}
            >
              <Pencil size={12} />
              Modifier
            </Button>
          </div>
        ) : null}

        {created && (
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
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  En attente client
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Le client verra la popup à sa prochaine connexion.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
