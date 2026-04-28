"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Check, CreditCard, Loader2, X } from "lucide-react"
import {
  acceptQuoteAction,
  createDepositCheckoutAction,
  rejectQuoteAction,
} from "./actions"
import { formatEuros } from "@/lib/pricing"

type Props = {
  token: string
  depositCents: number
  prefilledName: string
}

export function DecisionButtons({ token, depositCents, prefilledName }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [signatureName, setSignatureName] = useState(prefilledName)
  const [agreed, setAgreed] = useState(false)

  const requiresDeposit = depositCents > 0
  const canAccept = signatureName.trim().length >= 2 && agreed

  const accept = () => {
    setError(null)
    if (!canAccept) {
      setError("Saisis ton nom complet et coche l'accord pour continuer.")
      return
    }
    startTransition(async () => {
      if (requiresDeposit) {
        const res = await createDepositCheckoutAction(
          token,
          signatureName.trim(),
        )
        if (!res.ok) {
          setError(res.error)
          return
        }
        window.location.href = res.url
        return
      }
      const res = await acceptQuoteAction(token, signatureName.trim())
      if (!res.ok) {
        setError(res.error)
      } else {
        window.location.reload()
      }
    })
  }

  const reject = () => {
    setError(null)
    startTransition(async () => {
      const res = await rejectQuoteAction(token)
      if (!res.ok) {
        setError(res.error ?? "Erreur")
      } else {
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Signature électronique
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="signature-name">
            Saisissez votre nom complet pour signer
          </Label>
          <Input
            id="signature-name"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Ex. Nathalie Martin"
            autoComplete="name"
            className="font-medium"
          />
        </div>
        <label
          htmlFor="signature-agree"
          className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground"
        >
          <Checkbox
            id="signature-agree"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5"
          />
          <span>
            J&apos;accepte la proposition commerciale d&apos;Expansion Agency
            telle que décrite ci-dessus et j&apos;atteste être habilité(e) à
            engager ma société.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          onClick={accept}
          disabled={pending || !canAccept}
          className="min-w-[240px]"
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : requiresDeposit ? (
            <CreditCard size={16} />
          ) : (
            <Check size={16} />
          )}
          {requiresDeposit
            ? `Régler l'acompte (${formatEuros(depositCents)}) et signer`
            : "Signer et accepter le devis"}
        </Button>
        {!confirmReject ? (
          <Button
            size="lg"
            variant="ghost"
            onClick={() => setConfirmReject(true)}
            disabled={pending}
            className="text-muted-foreground"
          >
            Refuser
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={reject}
              disabled={pending}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <X size={14} />
              Confirmer le refus
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => setConfirmReject(false)}
              disabled={pending}
            >
              Annuler
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
