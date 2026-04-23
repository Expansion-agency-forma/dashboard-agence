import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import {
  adminTasks,
  clientAccess,
  clientFiles,
  clientFormationIntake,
  clientIntake,
  clients,
  onboardingSteps,
} from "@/db/schema"
import { asc, desc, eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  FileText,
  FileUp,
  GraduationCap,
  KeyRound,
  ListChecks,
  Mail,
  Sparkles,
} from "lucide-react"
import { INTAKE_QUESTIONS } from "@/app/intake/questions"
import { TasksPanel } from "./tasks-panel"
import { ServicesEditor } from "./services-editor"
import { ShootDateCard } from "./shoot-date-card"
import { StepEditor } from "./step-editor"
import { ClientControls } from "./client-controls"
import { Uploader } from "@/components/uploader"
import { AccessForm } from "@/components/access-form"
import { getStepDescription, seedDefaultSteps } from "@/lib/onboarding"
import { decrypt } from "@/lib/crypto"

export const dynamic = "force-dynamic"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`
}

const clientStatusStyle: Record<string, string> = {
  invited: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  archived: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
}
const clientStatusLabel: Record<string, string> = {
  invited: "Invité",
  active: "Actif",
  archived: "Archivé",
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await auth()

  const [client] = await db.select().from(clients).where(eq(clients.id, id))
  if (!client) notFound()

  let steps = await db
    .select()
    .from(onboardingSteps)
    .where(eq(onboardingSteps.clientId, id))
    .orderBy(asc(onboardingSteps.stepOrder))

  if (steps.length === 0) {
    await seedDefaultSteps(id)
    steps = await db
      .select()
      .from(onboardingSteps)
      .where(eq(onboardingSteps.clientId, id))
      .orderBy(asc(onboardingSteps.stepOrder))
  }

  const files = await db
    .select()
    .from(clientFiles)
    .where(eq(clientFiles.clientId, id))
    .orderBy(desc(clientFiles.createdAt))

  const [accessRow] = await db
    .select()
    .from(clientAccess)
    .where(eq(clientAccess.clientId, id))

  const [intake] = await db
    .select()
    .from(clientIntake)
    .where(eq(clientIntake.clientId, id))

  const tasks = await db
    .select()
    .from(adminTasks)
    .where(eq(adminTasks.clientId, id))
    .orderBy(asc(adminTasks.done), desc(adminTasks.createdAt))

  const pendingTasksCount = tasks.filter((t) => !t.done).length
  const hasPub = client.services.includes("pub")
  const hasFormation = client.services.includes("formation")

  const [formationIntake] = await db
    .select()
    .from(clientFormationIntake)
    .where(eq(clientFormationIntake.clientId, id))

  const decryptedAccess = accessRow
    ? {
        facebookEmail: accessRow.facebookEmail,
        facebookPassword: decrypt(accessRow.facebookPasswordEnc) || null,
        instagramEmail: accessRow.instagramEmail,
        instagramPassword: decrypt(accessRow.instagramPasswordEnc) || null,
        notes: accessRow.notes,
      }
    : null

  const doneCount = steps.filter((s) => s.status === "done").length
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-auto px-2 py-1">
            <Link href="/admin/clients">
              <ArrowLeft size={14} />
              Tous les clients
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <Badge variant="outline" className={clientStatusStyle[client.status]}>
              {clientStatusLabel[client.status]}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail size={14} />
              {client.email}
            </span>
            {client.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 size={14} />
                {client.company}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar size={14} />
              Créé le{" "}
              {new Intl.DateTimeFormat("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              }).format(client.createdAt)}
            </span>
          </div>
          <div className="mt-3">
            <ServicesEditor clientId={client.id} initial={client.services} />
          </div>
        </div>

        <ClientControls clientId={client.id} status={client.status} />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progression globale</CardTitle>
            <CardDescription>
              {doneCount} étape{doneCount > 1 ? "s" : ""} terminée
              {doneCount > 1 ? "s" : ""} sur {steps.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1" />
              <span className="min-w-[3ch] text-right text-2xl font-semibold tabular-nums">
                {progress}%
              </span>
            </div>
          </CardContent>
        </Card>

        <ShootDateCard clientId={client.id} initial={client.shootDate} />
      </div>

      <Tabs defaultValue={pendingTasksCount > 0 ? "tasks" : "steps"}>
        <TabsList>
          <TabsTrigger value="tasks">
            <CheckSquare size={14} />
            À faire
            {pendingTasksCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-5 border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] px-1.5 text-xs text-[var(--brand-gold)]"
              >
                {pendingTasksCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="steps">
            <ListChecks size={14} />
            Étapes
          </TabsTrigger>
          {hasPub && (
            <TabsTrigger value="brief">
              <Sparkles size={14} />
              Brief
              {intake?.completedAt ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  ✓
                </Badge>
              ) : intake ? (
                <Badge
                  variant="outline"
                  className="ml-1 h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-xs text-amber-700 dark:text-amber-300"
                >
                  Brouillon
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
          {hasFormation && (
            <TabsTrigger value="formation">
              <GraduationCap size={14} />
              Livret
              {formationIntake?.completedAt ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  ✓
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
          <TabsTrigger value="files">
            <FileText size={14} />
            Fichiers
            {files.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {files.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="access">
            <KeyRound size={14} />
            Accès
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tâches internes</CardTitle>
              <CardDescription>
                Ce qu&apos;il reste à faire sur ce client. Visibles uniquement
                par l&apos;agence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TasksPanel
                clientId={client.id}
                tasks={tasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  description: t.description,
                  done: t.done,
                  createdAt: t.createdAt,
                  completedAt: t.completedAt,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps" className="space-y-4">
          {steps.map((step, idx) => {
            const description = getStepDescription(step.title)
            const done = step.status === "done"
            return (
              <Card key={step.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={
                        done
                          ? "mt-1 text-emerald-500"
                          : step.status === "in_progress"
                          ? "mt-1 text-amber-500"
                          : "mt-1 text-muted-foreground"
                      }
                      aria-hidden
                    >
                      {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </span>
                    <div>
                      <CardTitle className="text-base">
                        Étape {idx + 1} — {step.title}
                      </CardTitle>
                      {description && (
                        <CardDescription className="mt-1">
                          {description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <StepEditor
                    stepId={step.id}
                    clientId={client.id}
                    initialStatus={step.status}
                    initialNotes={step.notes}
                  />
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {hasPub && (
          <TabsContent value="brief">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brief publicitaire</CardTitle>
              <CardDescription>
                {intake?.completedAt
                  ? `Complété le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(intake.completedAt)}.`
                  : intake
                  ? "Le client a commencé à remplir son brief mais ne l'a pas encore validé."
                  : "Le client n'a pas encore rempli son brief."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {intake ? (
                INTAKE_QUESTIONS.map((q) => {
                  const answer = intake[q.key]
                  return (
                    <div key={q.key} className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {q.number}. {q.label}
                      </p>
                      {answer ? (
                        <p className="whitespace-pre-wrap rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
                          {answer}
                        </p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">
                          Non renseigné
                        </p>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  La modale bloquante s&apos;ouvre automatiquement sur l&apos;espace
                  client tant que le brief n&apos;est pas validé.
                </p>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        )}

        {hasFormation && (
          <TabsContent value="formation">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Livret de formation</CardTitle>
                <CardDescription>
                  {formationIntake?.completedAt
                    ? `Déposé le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(formationIntake.completedAt)}.`
                    : "Le client n'a pas encore déposé son livret de formation."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {formationIntake?.livretUrl ? (
                  <a
                    href={formationIntake.livretUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] p-4 transition-colors hover:bg-[rgba(201,168,76,0.18)]"
                  >
                    <FileUp size={20} className="text-[var(--brand-gold)]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {formationIntake.livretName ?? "Livret"}
                      </p>
                      {formationIntake.livretSize ? (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(formationIntake.livretSize)}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs text-[var(--brand-gold)]">Ouvrir</span>
                  </a>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    La modale bloquante s&apos;ouvre automatiquement sur l&apos;espace
                    client tant que le livret n&apos;est pas déposé.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fichiers du client</CardTitle>
              <CardDescription>
                Broll, briefs, visuels, exports. Déposés par le client ou par l&apos;agence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Uploader
                clientId={client.id}
                files={files.map((f) => ({
                  id: f.id,
                  name: f.name,
                  url: f.url,
                  size: f.size,
                  contentType: f.contentType,
                  createdAt: f.createdAt,
                  uploadedBy: f.uploadedBy,
                }))}
                currentUserId={userId ?? ""}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accès publicitaires</CardTitle>
              <CardDescription>
                Business Manager, Pixel, comptes sociaux. Pas de mots de passe —
                utiliser les invitations natives des plateformes pour les accès sensibles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessForm clientId={client.id} access={decryptedAccess} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
