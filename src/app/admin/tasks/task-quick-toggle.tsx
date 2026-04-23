"use client"

import { useTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { toggleTaskAction } from "@/app/admin/clients/[id]/tasks-actions"

export function TaskQuickToggle({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Checkbox
      checked={false}
      disabled={pending}
      onCheckedChange={(v) => {
        startTransition(async () => {
          try {
            await toggleTaskAction(taskId, v === true)
          } catch (err) {
            console.error(err)
          }
        })
      }}
      className="mt-0.5"
      aria-label="Marquer comme terminée"
    />
  )
}
