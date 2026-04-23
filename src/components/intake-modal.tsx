"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { upload } from "@vercel/blob/client"
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
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import {
  INTAKE_QUESTIONS,
  type IntakeQuestion,
} from "@/app/intake/questions"
import {
  completeIntakeAction,
  saveIntakeDraftAction,
  type IntakeFieldKey,
} from "@/app/intake/actions"
import { completeFormationIntakeAction } from "@/app/intake/formation-actions"

type Step =
  | { kind: "intro" }
  | { kind: "question"; question: IntakeQuestion }
  | { kind: "livret" }

type Props = {
  clientId: string
  clientName: string
  needsPub: boolean
  needsFormation: boolean
  initial: Partial<Record<IntakeFieldKey, string | null>>
  existingLivret?: { url: string; name: string } | null
}

export function IntakeModal({
  clientId,
  clientName,
  needsPub,
  needsFormation,
  initial,
  existingLivret = null,
}: Props) {
  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [{ kind: "intro" }]
    if (needsPub) {
      for (const q of INTAKE_QUESTIONS) out.push({ kind: "question", question: q })
    }
    if (needsFormation) out.push({ kind: "livret" })
    return out
  }, [needsPub, needsFormation])

  const firstUnansweredIndex = useMemo(() => {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (s.kind === "question" && !initial[s.question.key]) return i
    }
    if (needsFormation && !existingLivret) {
      const livretIdx = steps.findIndex((s) => s.kind === "livret")
      if (livretIdx !== -1) return livretIdx
    }
    return 0
  }, [steps, initial, needsFormation, existingLivret])

  const [stepIdx, setStepIdx] = useState(firstUnansweredIndex)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const q of INTAKE_QUESTIONS) {
      out[q.key] = initial[q.key] ?? ""
    }
    return out
  })
  const [livretUploaded, setLivretUploaded] = useState<{
    url: string
    name: string
    pathname: string
    size: number
    contentType?: string
  } | null>(
    existingLivret
      ? {
          url: existingLivret.url,
          name: existingLivret.name,
          pathname: existingLivret.url.split("/").pop() ?? "livret",
          size: 0,
        }
      : null,
  )
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const step = steps[stepIdx]
  const questionSteps = steps.filter((s) => s.kind === "question").length
  const answeredQuestionCount = steps
    .slice(1, stepIdx + 1)
    .filter((s) => s.kind === "question" && values[s.question.key]?.trim())
    .length

  // Progress: intro = 0%, each question/upload step counts
  const totalSteps = steps.length - 1 // exclude intro
  const completedSteps = Math.max(0, stepIdx - (stepIdx > 0 ? 0 : 0))
  const progress =
    stepIdx === 0
      ? 0
      : Math.round((Math.min(stepIdx, totalSteps) / totalSteps) * 100)

  const canProceedQuestion =
    step.kind === "question" && values[step.question.key].trim().length > 0
  const canProceedLivret = step.kind === "livret" && !!livretUploaded
  const isLast = stepIdx === steps.length - 1

  const persistDraft = () => {
    const payload = {
      clientId,
      ...(values as Partial<Record<IntakeFieldKey, string>>),
    }
    startTransition(async () => {
      try {
        if (needsPub) await saveIntakeDraftAction(payload)
      } catch (err) {
        console.error("[intake] saveDraft failed:", err)
      }
    })
  }

  const onNext = () => {
    if (step.kind === "question" && !canProceedQuestion) return
    if (step.kind === "livret" && !canProceedLivret) return
    setError(null)
    if (step.kind === "question") persistDraft()
    setStepIdx((s) => Math.min(s + 1, steps.length - 1))
  }

  const onBack = () => {
    setError(null)
    setStepIdx((s) => Math.max(s - 1, 0))
  }

  const handleFileSelect = async (file: File) => {
    setUploadError(null)
    setUploadProgress(0)
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ clientId, kind: "livret" }),
        onUploadProgress: ({ loaded, total }) => {
          setUploadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0)
        },
      })
      setLivretUploaded({
        url: blob.url,
        name: file.name,
        pathname: blob.pathname,
        size: file.size,
        contentType: file.type,
      })
      setUploadProgress(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur à l'upload")
      setUploadProgress(null)
    }
  }

  const onSubmit = () => {
    setError(null)
    startTransition(async () => {
      try {
        if (needsPub) {
          await completeIntakeAction({
            clientId,
            ...(values as Partial<Record<IntakeFieldKey, string>>),
          })
        }
        if (needsFormation && livretUploaded) {
          await completeFormationIntakeAction({
            clientId,
            name: livretUploaded.name,
            pathname: livretUploaded.pathname,
            url: livretUploaded.url,
            size: livretUploaded.size,
            contentType: livretUploaded.contentType,
          })
        }
        window.location.reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur à la soumission.")
      }
    })
  }

  // Intro content varies based on service mix
  const introTitle =
    needsPub && needsFormation
      ? "On prépare votre projet en 2 étapes"
      : needsPub
        ? "Brief publicitaire"
        : "Livret de formation"

  const introSubtitle =
    needsPub && needsFormation
      ? "D'abord votre brief publicitaire (10 questions, ~10 min), puis le dépôt de votre livret de formation."
      : needsPub
        ? "10 questions, ~10 minutes, pour qu'on calibre vos campagnes sur votre offre."
        : "Déposez votre livret de formation pour qu'on puisse lancer la production des modules."

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
          {step.kind === "intro" ? (
            <div className="flex flex-col gap-6 px-8 py-10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--brand-gold)]">
                <Sparkles size={14} />
                Onboarding
              </div>
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Bonjour{" "}
                  <span className="brand-italic text-[var(--brand-gold)]">
                    {clientName}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">{introTitle}.</strong>
                  <br />
                  {introSubtitle}
                </DialogDescription>
              </DialogHeader>

              {needsPub && needsFormation && (
                <ul className="space-y-2 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-gold)] text-xs font-semibold text-[#170000]">
                      1
                    </span>
                    <span>Brief publicitaire — {INTAKE_QUESTIONS.length} questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-gold)] text-xs font-semibold text-[#170000]">
                      2
                    </span>
                    <span>Dépôt du livret de formation</span>
                  </li>
                </ul>
              )}

              <div className="flex items-center justify-end">
                <Button size="lg" onClick={() => setStepIdx(1)}>
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
                    Étape {stepIdx} / {totalSteps}
                    {step.kind === "livret" ? " — Livret de formation" : ""}
                  </span>
                  <span className="text-[var(--brand-gold)]">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              {step.kind === "question" ? (
                <div className="flex flex-col gap-4 px-8 py-8">
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {step.question.label}
                  </h2>
                  {step.question.hint && (
                    <p className="text-sm text-muted-foreground">
                      {step.question.hint}
                    </p>
                  )}
                  {step.question.key === "brandName" ? (
                    <Input
                      autoFocus
                      value={values[step.question.key] ?? ""}
                      placeholder={step.question.placeholder}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [step.question.key]: e.target.value,
                        }))
                      }
                      className="text-base"
                    />
                  ) : (
                    <Textarea
                      autoFocus
                      value={values[step.question.key] ?? ""}
                      placeholder={step.question.placeholder}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [step.question.key]: e.target.value,
                        }))
                      }
                      rows={8}
                      className="min-h-[160px] text-base leading-relaxed"
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-5 px-8 py-8">
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Déposez votre livret de formation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Le document qui décrit votre formation (programme, modules,
                    objectifs). Format PDF, Word, Keynote ou Google Docs exporté.
                  </p>

                  {livretUploaded ? (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-4">
                      <CheckCircle2 size={20} className="text-[var(--brand-gold)]" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{livretUploaded.name}</p>
                        <a
                          href={livretUploaded.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--brand-gold)] hover:underline"
                        >
                          Voir le fichier
                        </a>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLivretUploaded(null)
                          fileInputRef.current?.click()
                        }}
                      >
                        Remplacer
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-[var(--brand-gold-border)] hover:bg-[var(--brand-gold-soft)]"
                    >
                      <FileUp size={28} className="text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Cliquez pour choisir votre livret
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PDF · DOCX · PPTX · Keynote · jusqu&apos;à 200 Mo
                      </span>
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.key,.pages,.odt,.odp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleFileSelect(file)
                      e.target.value = ""
                    }}
                  />

                  {uploadProgress !== null && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Upload en cours…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}
                  {uploadError && (
                    <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <X size={14} />
                      {uploadError}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="mx-8 mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-8 py-4">
                <Button
                  variant="ghost"
                  onClick={onBack}
                  disabled={stepIdx === 1 || pending}
                >
                  <ArrowLeft size={14} />
                  Précédent
                </Button>

                {isLast ? (
                  <Button
                    onClick={onSubmit}
                    disabled={
                      pending ||
                      (step.kind === "question" && !canProceedQuestion) ||
                      (step.kind === "livret" && !canProceedLivret)
                    }
                  >
                    {pending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Envoi…
                      </>
                    ) : (
                      <>
                        Valider
                        <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={onNext}
                    disabled={
                      pending ||
                      (step.kind === "question" && !canProceedQuestion) ||
                      (step.kind === "livret" && !canProceedLivret)
                    }
                  >
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
