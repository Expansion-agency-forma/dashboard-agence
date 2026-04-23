"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Calendar, Check, Loader2, Pencil, X } from "lucide-react"
import { updateShootDateAction } from "./tasks-actions"

type Props = {
  clientId: string
  initial: Date | null
}

function toInputValue(date: Date | null): string {
  if (!date) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatDisplay(date: Date | null): string {
  if (!date) return ""
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

function daysUntil(date: Date | null): string | null {
  if (!date) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return "Demain"
  if (diff === -1) return "Hier"
  if (diff > 0) return `dans ${diff} jour${diff > 1 ? "s" : ""}`
  return `il y a ${Math.abs(diff)} jour${Math.abs(diff) > 1 ? "s" : ""}`
}

export function ShootDateCard({ clientId, initial }: Props) {
  const [current, setCurrent] = useState<Date | null>(initial)
  const [editing, setEditing] = useState<boolean>(!initial)
  const [value, setValue] = useState(toInputValue(initial))
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const save = () => {
    startTransition(async () => {
      try {
        await updateShootDateAction(clientId, value || null)
        setCurrent(value ? new Date(`${value}T00:00:00`) : null)
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        console.error(err)
      }
    })
  }

  const clear = () => {
    startTransition(async () => {
      try {
        await updateShootDateAction(clientId, null)
        setCurrent(null)
        setValue("")
        setEditing(true)
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar size={16} className="text-[var(--brand-gold)]" />
            Date de tournage
          </CardTitle>
          <CardDescription>
            Visible par le client sur son espace.
          </CardDescription>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} /> Enregistrée
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!editing && current ? (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                <span className="brand-italic text-[var(--brand-gold)]">
                  {formatDisplay(current).charAt(0).toUpperCase() +
                    formatDisplay(current).slice(1)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{daysUntil(current)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setValue(toInputValue(current))
                  setEditing(true)
                }}
                disabled={pending}
              >
                <Pencil size={12} />
                Modifier
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clear}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive"
              >
                <X size={12} />
                Retirer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px] space-y-1">
              <label
                htmlFor="shoot-date-input"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Sélectionner la date
              </label>
              <Input
                id="shoot-date-input"
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={pending || !value}>
                {pending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                Enregistrer
              </Button>
              {current && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setValue(toInputValue(current))
                    setEditing(false)
                  }}
                >
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
