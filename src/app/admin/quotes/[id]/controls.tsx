"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Send,
  Loader2,
  Trash2,
  X,
} from "lucide-react"
import {
  deleteQuoteAction,
  markQuoteSentAction,
  setQuoteStatusAction,
} from "../actions"

type Props = {
  quoteId: string
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
  clientId: string | null
}

export function QuoteAdminControls({ quoteId, status, clientId }: Props) {
  const [pending, startTransition] = useTransition()

  const markSent = () => {
    startTransition(async () => {
      try {
        await markQuoteSentAction(quoteId)
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  const reject = () => {
    if (!confirm("Marquer ce devis comme refusé ?")) return
    startTransition(async () => {
      try {
        await setQuoteStatusAction(quoteId, "rejected")
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  const remove = () => {
    if (!confirm("Supprimer ce devis ? Cette action est irréversible.")) return
    startTransition(async () => {
      try {
        await deleteQuoteAction(quoteId)
      } catch (err) {
        console.error(err)
        alert(err instanceof Error ? err.message : "Erreur")
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {status === "draft" && (
        <Button onClick={markSent} disabled={pending} size="sm">
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Marquer comme envoyé
        </Button>
      )}
      {status === "sent" && (
        <Button onClick={reject} disabled={pending} size="sm" variant="outline">
          <X size={12} />
          Marquer refusé
        </Button>
      )}
      {!clientId && status !== "accepted" && (
        <Button
          onClick={remove}
          disabled={pending}
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={12} />
          Supprimer
        </Button>
      )}
    </div>
  )
}
