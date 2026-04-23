"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Archive, RotateCcw, Trash2 } from "lucide-react"
import {
  archiveClientAction,
  reactivateClientAction,
  deleteClientAction,
} from "./actions"

type Props = {
  clientId: string
  status: "invited" | "active" | "archived"
}

export function ClientControls({ clientId, status }: Props) {
  const [pending, startTransition] = useTransition()

  const archive = () =>
    startTransition(async () => {
      try {
        await archiveClientAction(clientId)
      } catch (err) {
        console.error(err)
      }
    })

  const reactivate = () =>
    startTransition(async () => {
      try {
        await reactivateClientAction(clientId)
      } catch (err) {
        console.error(err)
      }
    })

  const destroy = () => {
    if (!confirm("Supprimer définitivement ce client et toutes ses étapes ?")) return
    startTransition(async () => {
      try {
        await deleteClientAction(clientId)
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {status === "archived" ? (
        <Button variant="outline" size="sm" onClick={reactivate} disabled={pending}>
          <RotateCcw size={14} />
          Réactiver
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={archive} disabled={pending}>
          <Archive size={14} />
          Archiver
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={destroy} disabled={pending} className="text-destructive hover:text-destructive">
        <Trash2 size={14} />
        Supprimer
      </Button>
    </div>
  )
}
