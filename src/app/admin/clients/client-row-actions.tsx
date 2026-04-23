"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy, Send } from "lucide-react"
import { resendInvitationAction } from "./actions"

export function ClientRowActions({
  clientId,
  invitationUrl,
}: {
  clientId: string
  invitationUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [resent, setResent] = useState(false)

  const copyLink = async () => {
    if (!invitationUrl) return
    try {
      await navigator.clipboard.writeText(invitationUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard denied */
    }
  }

  const resend = () => {
    startTransition(async () => {
      try {
        await resendInvitationAction(clientId)
        setResent(true)
        setTimeout(() => setResent(false), 1800)
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {invitationUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copyLink}
          title="Copier le lien d'invitation"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié" : "Lien"}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={resend}
        disabled={pending}
        title="Renvoyer l'email d'invitation"
      >
        {resent ? <Check size={14} /> : <Send size={14} />}
        {pending ? "…" : resent ? "Envoyé" : "Renvoyer"}
      </Button>
    </div>
  )
}
