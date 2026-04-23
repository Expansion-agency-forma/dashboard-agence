"use client"

import { useState, useTransition } from "react"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import { updateStepNotesAction, updateStepStatusAction } from "./actions"
import { STEP_STATUS_LABELS } from "@/lib/onboarding"

type StepStatus = keyof typeof STEP_STATUS_LABELS

type Props = {
  stepId: string
  clientId: string
  initialStatus: StepStatus
  initialNotes: string | null
}

export function StepEditor({ stepId, clientId, initialStatus, initialNotes }: Props) {
  const [status, setStatus] = useState<StepStatus>(initialStatus)
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const onStatusChange = (next: StepStatus) => {
    setStatus(next)
    startTransition(async () => {
      try {
        await updateStepStatusAction(stepId, clientId, next)
        setSavedAt(Date.now())
      } catch (err) {
        console.error(err)
      }
    })
  }

  const onSaveNotes = () => {
    startTransition(async () => {
      try {
        await updateStepNotesAction(stepId, clientId, notes)
        setSavedAt(Date.now())
      } catch (err) {
        console.error(err)
      }
    })
  }

  const notesDirty = (notes ?? "") !== (initialNotes ?? "")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as StepStatus)}
          disabled={pending}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STEP_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {pending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        {!pending && savedAt && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={12} /> Enregistré
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes internes sur cette étape (visibles par le client)…"
          rows={3}
          maxLength={2000}
        />
        {notesDirty && (
          <div>
            <Button type="button" size="sm" onClick={onSaveNotes} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer les notes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
