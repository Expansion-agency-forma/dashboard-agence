"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react"
import { confirmCardAddedAction } from "@/app/admin/clients/[id]/tasks-actions"

type Props = {
  clientId: string
  adAccountName: string
}

const LOOM_EMBED_URL =
  "https://www.loom.com/embed/d2f0d433ed644d58a2b7bd4aa6120b2c"

export function CardAddModal({ clientId, adAccountName }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      try {
        await confirmCardAddedAction(clientId)
        window.location.reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur — réessayez.")
      }
    })
  }

  return (
    <Dialog open={true}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <div className="flex flex-col">
          <div className="flex flex-col gap-5 px-8 py-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--brand-gold)]">
              <CreditCard size={14} />
              Action requise
            </div>
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Ajoutez votre carte{" "}
                <span className="brand-italic text-[var(--brand-gold)]">
                  au compte publicitaire
                </span>
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                Votre compte publicitaire{" "}
                <span className="font-semibold text-foreground">
                  {adAccountName}
                </span>{" "}
                est prêt. Pour qu&apos;on puisse lancer vos campagnes, il faut
                ajouter votre moyen de paiement directement sur le compte.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-hidden rounded-lg border border-border bg-black">
              <div className="relative aspect-video w-full">
                <iframe
                  src={LOOM_EMBED_URL}
                  className="absolute inset-0 h-full w-full"
                  frameBorder={0}
                  allow="fullscreen; clipboard-write"
                  allowFullScreen
                  title="Tutoriel — Ajouter votre carte au compte publicitaire"
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Suivez la vidéo ci-dessus (2 minutes). Une fois la carte enregistrée
              sur le compte, cliquez sur le bouton en bas pour nous le faire savoir.
            </p>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-card/60 px-8 py-4">
            <Button onClick={confirm} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  J&apos;ai ajouté ma carte au compte
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
