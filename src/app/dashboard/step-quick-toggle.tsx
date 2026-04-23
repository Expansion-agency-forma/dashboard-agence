"use client"

import { useTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { updateStepStatusAction } from "@/app/admin/clients/[id]/actions"

export function StepQuickToggle({
  stepId,
  clientId,
}: {
  stepId: string
  clientId: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Checkbox
      checked={false}
      disabled={pending}
      onCheckedChange={(v) => {
        if (v !== true) return
        startTransition(async () => {
          try {
            await updateStepStatusAction(stepId, clientId, "done")
          } catch (err) {
            console.error(err)
          }
        })
      }}
      className="mt-0.5"
      aria-label="Marquer l'étape comme terminée"
    />
  )
}
