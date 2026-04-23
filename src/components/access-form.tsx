"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Check, Loader2 } from "lucide-react"
import { upsertAccessAction } from "@/app/admin/clients/[id]/access-actions"
import type { ClientAccess } from "@/db/schema"

type Props = {
  clientId: string
  access: ClientAccess | null
  readOnly?: boolean
}

const FIELDS: Array<{
  name: keyof Omit<ClientAccess, "clientId" | "createdAt" | "updatedAt" | "updatedBy">
  label: string
  placeholder: string
  hint?: string
}> = [
  {
    name: "metaBusinessId",
    label: "Business Manager ID (Meta)",
    placeholder: "123456789012345",
    hint: "L'ID de ton Business Manager, visible dans Meta Business Suite.",
  },
  {
    name: "metaAdAccountId",
    label: "Compte publicitaire Meta",
    placeholder: "act_123456789012345",
  },
  {
    name: "metaPixelId",
    label: "Pixel ID",
    placeholder: "987654321098765",
  },
  {
    name: "metaPageUrl",
    label: "Page Facebook",
    placeholder: "https://www.facebook.com/votrepage",
  },
  {
    name: "tiktokHandle",
    label: "Compte TikTok",
    placeholder: "@votre_marque",
  },
  {
    name: "youtubeChannelUrl",
    label: "Chaîne YouTube",
    placeholder: "https://www.youtube.com/@votrechaine",
  },
  {
    name: "snapchatHandle",
    label: "Compte Snapchat",
    placeholder: "votre_marque",
  },
]

export function AccessForm({ clientId, access, readOnly = false }: Props) {
  const [state, action, pending] = useActionState(upsertAccessAction, null)

  const error = state && !state.ok ? state.message : undefined
  const saved = state?.ok

  if (readOnly) {
    return (
      <div className="space-y-5">
        {FIELDS.map((f) => {
          const val = access?.[f.name]
          if (!val) return null
          return (
            <div key={f.name} className="space-y-1">
              <Label>{f.label}</Label>
              <p className="break-words text-sm">{val}</p>
            </div>
          )
        })}
        {access?.notes && (
          <div className="space-y-1">
            <Label>Notes</Label>
            <p className="whitespace-pre-wrap break-words text-sm">{access.notes}</p>
          </div>
        )}
        {!access &&
          FIELDS.every((f) => !access?.[f.name]) && (
            <p className="text-sm text-muted-foreground">
              Le client n&apos;a pas encore renseigné ses accès.
            </p>
          )}
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={clientId} />

      {FIELDS.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type="text"
            defaultValue={access?.[field.name] ?? ""}
            placeholder={field.placeholder}
            autoComplete="off"
          />
          {field.hint && (
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          )}
        </div>
      ))}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes libres</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={access?.notes ?? ""}
          placeholder="Informations complémentaires, accès spécifiques…"
          rows={4}
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Enregistrement…
            </>
          ) : (
            "Enregistrer les accès"
          )}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <Check size={14} /> Accès mis à jour
          </span>
        )}
      </div>
    </form>
  )
}
