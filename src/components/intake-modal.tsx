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
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileUp,
  Loader2,
  Sparkles,
  UserPlus,
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
import {
  confirmInviteSentAction,
  saveOnboardingCredentialsAction,
  setAdAccountPreferenceAction,
} from "@/app/intake/ad-account-actions"

type Step =
  | { kind: "intro" }
  | { kind: "question"; question: IntakeQuestion }
  | { kind: "choice" }
  | { kind: "invite" }
  | { kind: "credentials" }
  | { kind: "livret" }

type Preference = "invite" | "create" | null

type Props = {
  clientId: string
  clientName: string
  needsPub: boolean
  needsFormation: boolean
  needsBrief: boolean
  needsAdAccountChoice: boolean
  initialPreference: Preference
  initial: Partial<Record<IntakeFieldKey, string | null>>
  existingLivret?: { url: string; name: string } | null
}

const INVITE_LOOM_URL =
  "https://www.loom.com/embed/2593db9e9e2d4d3caf3dd70048b55dc9"

export function IntakeModal({
  clientId,
  clientName,
  needsPub,
  needsFormation,
  needsBrief,
  needsAdAccountChoice,
  initialPreference,
  initial,
  existingLivret = null,
}: Props) {
  const [preference, setPreference] = useState<Preference>(initialPreference)

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [{ kind: "intro" }]
    if (needsPub && needsBrief) {
      for (const q of INTAKE_QUESTIONS) out.push({ kind: "question", question: q })
    }
    if (needsPub && needsAdAccountChoice) {
      out.push({ kind: "choice" })
      if (preference === "invite") out.push({ kind: "invite" })
      else if (preference === "create") out.push({ kind: "credentials" })
    }
    if (needsFormation) out.push({ kind: "livret" })
    return out
  }, [needsPub, needsFormation, needsBrief, needsAdAccountChoice, preference])

  const firstUnansweredIndex = useMemo(() => {
    for (let i = 1; i < steps.length; i++) {
      const s = steps[i]
      if (s.kind === "question" && !initial[s.question.key]) return i
      if (s.kind === "choice" && !preference) return i
      if (s.kind === "livret" && !existingLivret) return i
    }
    return 0
  }, [steps, initial, preference, existingLivret])

  const [stepIdx, setStepIdx] = useState(firstUnansweredIndex)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const q of INTAKE_QUESTIONS) {
      out[q.key] = initial[q.key] ?? ""
    }
    return out
  })
  const [creds, setCreds] = useState({
    facebookEmail: "",
    facebookPassword: "",
    instagramEmail: "",
    instagramPassword: "",
  })
  const [credsSaved, setCredsSaved] = useState(false)
  const [inviteConfirmed, setInviteConfirmed] = useState(false)
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
  const totalSteps = steps.length - 1
  const progress =
    stepIdx === 0
      ? 0
      : Math.round((Math.min(stepIdx, totalSteps) / totalSteps) * 100)

  const canProceed = (() => {
    if (!step) return false
    if (step.kind === "intro") return true
    if (step.kind === "question") return values[step.question.key].trim().length > 0
    if (step.kind === "choice") return Boolean(preference)
    if (step.kind === "invite") return inviteConfirmed
    if (step.kind === "credentials") return credsSaved
    if (step.kind === "livret") return Boolean(livretUploaded)
    return false
  })()

  const isLast = stepIdx === steps.length - 1

  const persistDraft = () => {
    if (!needsPub || !needsBrief) return
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
    if (step.kind === "question") persistDraft()
    setStepIdx((s) => Math.min(s + 1, steps.length - 1))
  }

  const onBack = () => {
    setError(null)
    setStepIdx((s) => Math.max(s - 1, 0))
  }

  const pickPreference = (choice: "invite" | "create") => {
    setPreference(choice)
    // Persist the choice immediately so if the user closes & reopens,
    // the right sub-step shows up.
    startTransition(async () => {
      try {
        await setAdAccountPreferenceAction(clientId, choice)
      } catch (err) {
        console.error("[intake] setPreference failed:", err)
      }
    })
    // Advance into the sub-step automatically
    setStepIdx((s) => s + 1)
  }

  const confirmInvite = () => {
    setError(null)
    startTransition(async () => {
      try {
        await confirmInviteSentAction(clientId)
        setInviteConfirmed(true)
        setStepIdx((s) => Math.min(s + 1, steps.length - 1))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur — réessayez.")
      }
    })
  }

  const saveCredentials = () => {
    setError(null)
    if (
      !creds.facebookEmail.trim() ||
      !creds.facebookPassword.trim() ||
      !creds.instagramEmail.trim() ||
      !creds.instagramPassword.trim()
    ) {
      setError("Remplis tous les champs pour continuer.")
      return
    }
    startTransition(async () => {
      try {
        await saveOnboardingCredentialsAction({
          clientId,
          ...creds,
        })
        setCredsSaved(true)
        setStepIdx((s) => Math.min(s + 1, steps.length - 1))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur — réessayez.")
      }
    })
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
        if (needsPub && needsBrief) {
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

  // Intro header varies depending on what the client has to do
  const headerBits: string[] = []
  if (needsPub && needsBrief) headerBits.push("brief publicitaire")
  if (needsPub && needsAdAccountChoice) headerBits.push("compte publicitaire")
  if (needsFormation) headerBits.push("livret de formation")

  const introTitle =
    headerBits.length > 1 ? "On prépare votre projet en plusieurs étapes" : "Onboarding"

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
                  Quelques questions rapides pour qu&apos;on démarre dans les
                  meilleures conditions.
                </DialogDescription>
              </DialogHeader>

              {headerBits.length > 1 && (
                <ul className="space-y-2 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
                  {headerBits.map((bit, idx) => (
                    <li key={bit} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-gold)] text-xs font-semibold text-[#170000]">
                        {idx + 1}
                      </span>
                      <span className="first-letter:uppercase">{bit}</span>
                    </li>
                  ))}
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
                    {step.kind === "choice"
                      ? " — Compte publicitaire"
                      : step.kind === "invite"
                        ? " — Inviter l'agence"
                        : step.kind === "credentials"
                          ? " — Accès Facebook / Instagram"
                          : step.kind === "livret"
                            ? " — Livret de formation"
                            : ""}
                  </span>
                  <span className="text-[var(--brand-gold)]">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              <div className="flex flex-col gap-4 px-8 py-8">
                {step.kind === "question" && (
                  <>
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
                  </>
                )}

                {step.kind === "choice" && (
                  <>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Compte publicitaire — on fait comment ?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choisissez l&apos;option qui correspond à votre situation.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => pickPreference("invite")}
                        disabled={pending}
                        className={`flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                          preference === "invite"
                            ? "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)]"
                            : "border-border hover:border-[var(--brand-gold-border)]/60"
                        }`}
                      >
                        <UserPlus size={18} className="text-[var(--brand-gold)]" />
                        <span className="text-base font-semibold">
                          J&apos;ai déjà un compte publicitaire
                        </span>
                        <span className="text-xs text-muted-foreground">
                          J&apos;invite Expansion en tant qu&apos;administrateur sur
                          mon compte existant — une vidéo explique comment faire.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => pickPreference("create")}
                        disabled={pending}
                        className={`flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                          preference === "create"
                            ? "border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)]"
                            : "border-border hover:border-[var(--brand-gold-border)]/60"
                        }`}
                      >
                        <CreditCard size={18} className="text-[var(--brand-gold)]" />
                        <span className="text-base font-semibold">
                          Expansion me crée un compte
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Je confie mes accès Facebook et Instagram, Expansion monte
                          le compte publicitaire pour moi.
                        </span>
                      </button>
                    </div>
                  </>
                )}

                {step.kind === "invite" && (
                  <>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Invitez-nous sur votre compte publicitaire
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Regardez la vidéo pour voir comment nous ajouter en Admin,
                      puis cliquez sur le bouton en bas une fois l&apos;invitation
                      envoyée.
                    </p>
                    <div className="overflow-hidden rounded-lg border border-border bg-black">
                      <div className="relative aspect-video w-full">
                        <iframe
                          src={INVITE_LOOM_URL}
                          className="absolute inset-0 h-full w-full"
                          frameBorder={0}
                          allow="fullscreen; clipboard-write"
                          allowFullScreen
                          title="Tutoriel — Inviter Expansion sur votre compte publicitaire"
                        />
                      </div>
                    </div>
                    <div>
                      <Button onClick={confirmInvite} disabled={pending}>
                        {pending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        J&apos;ai envoyé l&apos;invitation
                      </Button>
                      {inviteConfirmed && (
                        <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-400">
                          Invitation enregistrée
                        </span>
                      )}
                    </div>
                  </>
                )}

                {step.kind === "credentials" && (
                  <>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Vos accès Facebook & Instagram
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      On créera votre compte publicitaire nous-mêmes. Vos
                      identifiants sont chiffrés au repos (AES-256) et
                      accessibles uniquement par votre gestionnaire.
                    </p>

                    <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
                      <p className="text-sm font-semibold">Facebook</p>
                      <div className="space-y-2">
                        <Label htmlFor="fb-email">Email</Label>
                        <Input
                          id="fb-email"
                          type="email"
                          value={creds.facebookEmail}
                          onChange={(e) =>
                            setCreds((c) => ({
                              ...c,
                              facebookEmail: e.target.value,
                            }))
                          }
                          placeholder="votre@email.com"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fb-pwd">Mot de passe</Label>
                        <Input
                          id="fb-pwd"
                          type="password"
                          value={creds.facebookPassword}
                          onChange={(e) =>
                            setCreds((c) => ({
                              ...c,
                              facebookPassword: e.target.value,
                            }))
                          }
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
                      <p className="text-sm font-semibold">Instagram</p>
                      <div className="space-y-2">
                        <Label htmlFor="ig-email">Email / identifiant</Label>
                        <Input
                          id="ig-email"
                          type="text"
                          value={creds.instagramEmail}
                          onChange={(e) =>
                            setCreds((c) => ({
                              ...c,
                              instagramEmail: e.target.value,
                            }))
                          }
                          placeholder="votre@email.com ou @handle"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ig-pwd">Mot de passe</Label>
                        <Input
                          id="ig-pwd"
                          type="password"
                          value={creds.instagramPassword}
                          onChange={(e) =>
                            setCreds((c) => ({
                              ...c,
                              instagramPassword: e.target.value,
                            }))
                          }
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <div>
                      <Button onClick={saveCredentials} disabled={pending}>
                        {pending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Enregistrer mes accès
                      </Button>
                      {credsSaved && (
                        <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-400">
                          Accès enregistrés
                        </span>
                      )}
                    </div>
                  </>
                )}

                {step.kind === "livret" && (
                  <>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Déposez votre livret de formation
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Le document qui décrit votre formation (programme,
                      modules, objectifs). Format PDF, Word, Keynote ou Google
                      Docs exporté.
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
                  </>
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
                  disabled={stepIdx === 1 || pending}
                >
                  <ArrowLeft size={14} />
                  Précédent
                </Button>

                {isLast ? (
                  <Button onClick={onSubmit} disabled={pending || !canProceed}>
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
                  <Button onClick={onNext} disabled={pending || !canProceed}>
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
