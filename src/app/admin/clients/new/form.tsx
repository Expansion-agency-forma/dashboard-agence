"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Megaphone, GraduationCap } from "lucide-react"
import { createClientAction } from "../actions"

const SERVICE_OPTIONS = [
  {
    id: "pub",
    label: "Publicité",
    description: "Meta · TikTok · YouTube · Snap — campagnes au résultat",
    Icon: Megaphone,
  },
  {
    id: "formation",
    label: "Formation en ligne",
    description: "Tournage, montage, mise en module pédagogique, livraison clé en main",
    Icon: GraduationCap,
  },
] as const

export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAction, null)
  const [services, setServices] = useState<Record<string, boolean>>({
    pub: true,
    formation: false,
  })

  const errors = state && !state.ok ? state.errors : {}
  const globalMessage = state && !state.ok ? state.message : undefined
  const noneSelected = Object.values(services).every((v) => !v)

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom complet</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Nathalie Martin"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name?.[0] && (
          <p className="text-xs text-destructive">{errors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="nathalie@exemple.com"
          aria-invalid={Boolean(errors.email)}
        />
        <p className="text-xs text-muted-foreground">
          Le client recevra un lien magique pour créer son espace.
        </p>
        {errors.email?.[0] && (
          <p className="text-xs text-destructive">{errors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Organisme (optionnel)</Label>
        <Input
          id="company"
          name="company"
          type="text"
          placeholder="Institut Beauté & Co"
          aria-invalid={Boolean(errors.company)}
        />
        {errors.company?.[0] && (
          <p className="text-xs text-destructive">{errors.company[0]}</p>
        )}
      </div>

      <div className="space-y-3">
        <Label>Prestations</Label>
        <p className="text-xs text-muted-foreground">
          Sélectionne la ou les prestations qu&apos;on assure pour ce client.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICE_OPTIONS.map(({ id, label, description, Icon }) => {
            const checked = Boolean(services[id])
            return (
              <label
                key={id}
                htmlFor={`service-${id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  checked
                    ? "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)]"
                    : "border-border hover:border-[var(--brand-gold-border)]/60"
                }`}
              >
                <Checkbox
                  id={`service-${id}`}
                  name="services"
                  value={id}
                  checked={checked}
                  onCheckedChange={(v) =>
                    setServices((s) => ({ ...s, [id]: v === true }))
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      size={16}
                      className={checked ? "text-[var(--brand-gold)]" : "text-muted-foreground"}
                    />
                    <span className="font-medium">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </label>
            )
          })}
        </div>
        {noneSelected && (
          <p className="text-xs text-destructive">
            Sélectionne au moins une prestation.
          </p>
        )}
        {errors.services?.[0] && (
          <p className="text-xs text-destructive">{errors.services[0]}</p>
        )}
      </div>

      {globalMessage && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {globalMessage}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || noneSelected}>
          {pending ? "Création…" : "Créer et envoyer l'invitation"}
        </Button>
      </div>
    </form>
  )
}
