"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { GraduationCap, Megaphone, Pencil, Loader2 } from "lucide-react"
import { updateServicesAction } from "./tasks-actions"
import { SERVICE_LABELS, type ServiceType } from "@/db/schema"
import { ServicesBadges } from "@/components/services-badges"

export function ServicesEditor({
  clientId,
  initial,
}: {
  clientId: string
  initial: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<Record<ServiceType, boolean>>({
    pub: initial.includes("pub"),
    formation: initial.includes("formation"),
  })
  const [pending, startTransition] = useTransition()

  const save = () => {
    const selected = (Object.keys(picked) as ServiceType[]).filter(
      (k) => picked[k],
    )
    if (selected.length === 0) return
    startTransition(async () => {
      try {
        await updateServicesAction(clientId, selected)
        setEditing(false)
      } catch (err) {
        console.error(err)
      }
    })
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <ServicesBadges services={initial} />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil size={12} />
          Modifier
        </Button>
      </div>
    )
  }

  const options: Array<{ id: ServiceType; Icon: typeof Megaphone }> = [
    { id: "pub", Icon: Megaphone },
    { id: "formation", Icon: GraduationCap },
  ]
  const nothingPicked = Object.values(picked).every((v) => !v)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, Icon }) => {
          const checked = picked[id]
          return (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                checked
                  ? "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] text-[var(--brand-gold)]"
                  : "border-border text-muted-foreground hover:border-[var(--brand-gold-border)]/60"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) =>
                  setPicked((s) => ({ ...s, [id]: v === true }))
                }
              />
              <Icon size={14} />
              {SERVICE_LABELS[id]}
            </label>
          )
        })}
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={save} disabled={pending || nothingPicked}>
          {pending ? <Loader2 size={12} className="animate-spin" /> : null}
          Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
