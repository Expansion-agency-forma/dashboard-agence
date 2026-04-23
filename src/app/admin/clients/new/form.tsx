"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClientAction } from "../actions"

export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAction, null)

  const errors = state && !state.ok ? state.errors : {}
  const globalMessage = state && !state.ok ? state.message : undefined

  return (
    <form action={action} className="space-y-5">
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

      {globalMessage && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {globalMessage}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer et envoyer l'invitation"}
        </Button>
      </div>
    </form>
  )
}
