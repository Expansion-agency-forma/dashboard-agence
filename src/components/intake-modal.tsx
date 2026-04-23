"use client"

import { useMemo, useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react"
import {
  INTAKE_QUESTIONS,
  type IntakeQuestion,
} from "@/app/intake/questions"
import {
  completeIntakeAction,
  saveIntakeDraftAction,
  type IntakeFieldKey,
} from "@/app/intake/actions"

type Props = {
  clientId: string
  clientName: string
  initial: Partial<Record<IntakeFieldKey, string | null>>
}

export function IntakeModal({ clientId, clientName, initial }: Props) {
  const total = INTAKE_QUESTIONS.length
  const firstUnanswered = useMemo(() => {
    const idx = INTAKE_QUESTIONS.findIndex((q) => !initial[q.key])
    return idx === -1 ? 0 : idx
  }, [initial])

  const [step, setStep] = useState(firstUnanswered)
  const [intro, setIntro] = useState(true)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const q of INTAKE_QUESTIONS) {
      out[q.key] = initial[q.key] ?? ""
    }
    return out
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const question: IntakeQuestion = INTAKE_QUESTIONS[step]
  const currentValue = values[question.key] ?? ""
  const canProceed = currentValue.trim().length > 0
  const isLast = step === total - 1
  const progress = Math.round(((step + (canProceed ? 1 : 0)) / total) * 100)

  const persistDraft = () => {
    const payload = {
      clientId,
      ...(values as Partial<Record<IntakeFieldKey, string>>),
    }
    startTransition(async () => {
      try {
        await saveIntakeDraftAction(payload)
      } catch (err) {
        console.error("[intake] saveDraft failed:", err)
      }
    })
  }

  const onNext = () => {
    if (!canProceed) return
    setError(null)
    persistDraft()
    setStep((s) => Math.min(s + 1, total - 1))
  }

  const onBack = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const onSubmit = () => {
    if (!canProceed) return
    setError(null)
    startTransition(async () => {
      try {
        await completeIntakeAction({
          clientId,
          ...(values as Partial<Record<IntakeFieldKey, string>>),
        })
        // Reload so the server-rendered dashboard no longer passes initial={...}
        // and the modal disappears on its own.
        window.location.reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur à la soumission.")
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
          {intro ? (
            <div className="flex flex-col gap-6 px-8 py-10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--brand-gold)]">
                <Sparkles size={14} />
                Brief publicitaire
              </div>
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Bonjour{" "}
                  <span className="brand-italic text-[var(--brand-gold)]">
                    {clientName}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                  Avant qu&apos;on lance vos campagnes, on a besoin de bien comprendre
                  votre offre, votre audience et votre positionnement.
                  <br />
                  <span className="block pt-2">
                    10 questions, ~10 minutes, et vous êtes tranquille — on s&apos;occupe
                    ensuite du reste.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Vos réponses sont sauvegardées à chaque étape.
                </span>
              </div>
              <div className="flex items-center justify-end">
                <Button size="lg" onClick={() => setIntro(false)}>
                  Commencer
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-border bg-card/60 px-8 pb-5 pt-6">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                  <span>
                    Question {question.number} / {total}
                  </span>
                  <span className="text-[var(--brand-gold)]">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              <div className="flex flex-col gap-4 px-8 py-8">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {question.label}
                </h2>
                {question.hint && (
                  <p className="text-sm text-muted-foreground">{question.hint}</p>
                )}

                {question.key === "brandName" ? (
                  <Input
                    autoFocus
                    value={currentValue}
                    placeholder={question.placeholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [question.key]: e.target.value }))
                    }
                    className="text-base"
                  />
                ) : (
                  <Textarea
                    autoFocus
                    value={currentValue}
                    placeholder={question.placeholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [question.key]: e.target.value }))
                    }
                    rows={8}
                    className="min-h-[160px] text-base leading-relaxed"
                  />
                )}

                {error && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-8 py-4">
                <Button
                  variant="ghost"
                  onClick={onBack}
                  disabled={step === 0 || pending}
                >
                  <ArrowLeft size={14} />
                  Précédent
                </Button>

                {isLast ? (
                  <Button onClick={onSubmit} disabled={!canProceed || pending}>
                    {pending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Envoi…
                      </>
                    ) : (
                      <>
                        Valider mon brief
                        <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button onClick={onNext} disabled={!canProceed || pending}>
                    {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Suivant
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
