"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Check, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react"

function FacebookGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="#1877f2"
      aria-hidden="true"
    >
      <path d="M22 12a10 10 0 10-11.56 9.88v-7H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.88h-2.33v7A10 10 0 0022 12z" />
    </svg>
  )
}

function InstagramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ig-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdd835" />
          <stop offset="0.5" stopColor="#e4405f" />
          <stop offset="1" stopColor="#8a3ab9" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-g)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff" />
    </svg>
  )
}
import { upsertAccessAction } from "@/app/admin/clients/[id]/access-actions"

type DecryptedAccess = {
  facebookEmail: string | null
  facebookPassword: string | null
  instagramEmail: string | null
  instagramPassword: string | null
  notes: string | null
}

type Props = {
  clientId: string
  access: DecryptedAccess | null
  readOnly?: boolean
}

function PasswordField({
  label,
  name,
  keepName,
  initial,
}: {
  label: string
  name: string
  keepName: string
  initial: string | null
}) {
  const [show, setShow] = useState(false)
  const [dirty, setDirty] = useState(false)
  const hasInitial = Boolean(initial)

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          defaultValue={initial ?? ""}
          onChange={() => setDirty(true)}
          placeholder={hasInitial && !dirty ? "••••••••" : ""}
          autoComplete="new-password"
          autoCorrect="off"
          spellCheck={false}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-0 top-0 inline-flex h-full items-center justify-center px-3 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={show ? "Masquer" : "Afficher"}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <input type="hidden" name={keepName} value={dirty ? "change" : "keep"} />
    </div>
  )
}

export function AccessForm({ clientId, access, readOnly = false }: Props) {
  const [state, action, pending] = useActionState(upsertAccessAction, null)

  const error = state && !state.ok ? state.message : undefined
  const saved = state?.ok

  if (readOnly) {
    const rows: Array<[string, string | null]> = [
      ["Email Facebook", access?.facebookEmail ?? null],
      ["Mot de passe Facebook", access?.facebookPassword ? "••••••••" : null],
      ["Email Instagram", access?.instagramEmail ?? null],
      ["Mot de passe Instagram", access?.instagramPassword ? "••••••••" : null],
    ]
    const anyFilled = rows.some(([, v]) => v)
    return (
      <div className="space-y-4">
        {!anyFilled ? (
          <p className="text-sm text-muted-foreground">
            Aucun accès renseigné pour l&apos;instant.
          </p>
        ) : (
          rows
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <div key={label} className="space-y-1">
                <Label>{label}</Label>
                <p className="break-words text-sm">{v}</p>
              </div>
            ))
        )}
        {access?.notes && (
          <div className="space-y-1">
            <Label>Notes</Label>
            <p className="whitespace-pre-wrap break-words text-sm">{access.notes}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <p>
          Vos identifiants sont chiffrés au repos (AES-256-GCM) et
          accessibles uniquement par votre gestionnaire Expansion.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FacebookGlyph />
          Facebook
        </div>
        <div className="space-y-2">
          <Label htmlFor="facebookEmail">Email</Label>
          <Input
            id="facebookEmail"
            name="facebookEmail"
            type="email"
            defaultValue={access?.facebookEmail ?? ""}
            placeholder="votre@email.com"
            autoComplete="off"
          />
        </div>
        <PasswordField
          label="Mot de passe"
          name="facebookPassword"
          keepName="facebookPasswordKeep"
          initial={access?.facebookPassword ?? null}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <InstagramGlyph />
          Instagram
        </div>
        <div className="space-y-2">
          <Label htmlFor="instagramEmail">Email / identifiant</Label>
          <Input
            id="instagramEmail"
            name="instagramEmail"
            type="text"
            defaultValue={access?.instagramEmail ?? ""}
            placeholder="votre@email.com ou @handle"
            autoComplete="off"
          />
        </div>
        <PasswordField
          label="Mot de passe"
          name="instagramPassword"
          keepName="instagramPasswordKeep"
          initial={access?.instagramPassword ?? null}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes libres</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={access?.notes ?? ""}
          placeholder="2FA, mail de récup, spécificités…"
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
