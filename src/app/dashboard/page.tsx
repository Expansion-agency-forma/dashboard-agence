import Link from "next/link"
import { auth, currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { db } from "@/db/client"
import {
  adminTasks,
  clientAccess,
  clientFiles,
  clientFormationIntake,
  clientIntake,
  clients,
  onboardingSteps,
  type Client,
  type OnboardingStep,
  type ClientFile,
  type ClientAccess,
  type ClientIntake,
  type ClientFormationIntake,
} from "@/db/schema"
import { asc, desc, eq, ne } from "drizzle-orm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CheckSquare,
  Circle,
  CreditCard,
  FileText,
  FileUp,
  UserPlus,
  KeyRound,
  ListChecks,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react"
import { getRole } from "@/lib/auth"
import { getStepDescription, seedDefaultSteps, STEP_STATUS_LABELS } from "@/lib/onboarding"
import { Uploader } from "@/components/uploader"
import { AccessForm } from "@/components/access-form"
import { BrandMark } from "@/components/brand-mark"
import { IntakeModal } from "@/components/intake-modal"
import { ShootDateReadonly } from "@/components/shoot-date-readonly"
import { CardAddModal } from "@/components/card-add-modal"
import { decrypt } from "@/lib/crypto"
import { getRecentNotifications, formatRelativeTime } from "@/lib/notifications"
import { TaskQuickToggle } from "@/app/admin/tasks/task-quick-toggle"
import { StepQuickToggle } from "./step-quick-toggle"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await currentUser()
  const role = await getRole()
  const firstName = user?.firstName
  const email = user?.emailAddresses[0]?.emailAddress ?? null

  if (role === "agency") {
    return <AgencyDashboard firstName={firstName} />
  }

  return (
    <ClientDashboard
      firstName={firstName}
      email={email}
      userId={userId}
      user={user}
    />
  )
}

// =============================================================================
// Agency dashboard — tasks + notifications + quick actions
// =============================================================================
async function AgencyDashboard({ firstName }: { firstName: string | null | undefined }) {
  const [pendingTasks, pendingStepsRaw, notifications, clientsCount] = await Promise.all([
    db
      .select({
        id: adminTasks.id,
        title: adminTasks.title,
        description: adminTasks.description,
        createdAt: adminTasks.createdAt,
        clientId: clients.id,
        clientName: clients.name,
      })
      .from(adminTasks)
      .innerJoin(clients, eq(adminTasks.clientId, clients.id))
      .where(eq(adminTasks.done, false))
      .orderBy(asc(adminTasks.createdAt)),

    db
      .select({
        id: onboardingSteps.id,
        title: onboardingSteps.title,
        status: onboardingSteps.status,
        stepOrder: onboardingSteps.stepOrder,
        clientId: clients.id,
        clientName: clients.name,
        clientStatus: clients.status,
      })
      .from(onboardingSteps)
      .innerJoin(clients, eq(onboardingSteps.clientId, clients.id))
      .where(ne(onboardingSteps.status, "done"))
      .orderBy(asc(clients.name), asc(onboardingSteps.stepOrder)),

    getRecentNotifications(15),

    db.select({ count: clients.id }).from(clients),
  ])

  // Only surface pending steps for active clients (skip archived)
  const pendingSteps = pendingStepsRaw.filter((s) => s.clientStatus !== "archived")

  type TodoItem =
    | {
        kind: "task"
        id: string
        title: string
        description: string | null
        clientId: string
        clientName: string
        sortKey: number
      }
    | {
        kind: "step"
        id: string
        title: string
        clientId: string
        clientName: string
        stepId: string
        status: "pending" | "in_progress"
        stepOrder: number
        sortKey: number
      }

  const todoItems: TodoItem[] = [
    ...pendingTasks.map<TodoItem>((t, i) => ({
      kind: "task",
      id: `task-${t.id}`,
      title: t.title,
      description: t.description,
      clientId: t.clientId,
      clientName: t.clientName,
      sortKey: i,
    })),
    ...pendingSteps.map<TodoItem>((s) => ({
      kind: "step",
      id: `step-${s.id}`,
      title: s.title,
      clientId: s.clientId,
      clientName: s.clientName,
      stepId: s.id,
      status: s.status as "pending" | "in_progress",
      stepOrder: s.stepOrder,
      sortKey: 10_000 + s.stepOrder,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey)

  const totalTodos = todoItems.length

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12 md:py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Expansion Agency
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          </div>
        </div>
        <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
      </header>

      <section className="space-y-2">
        <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Bonjour
          {firstName ? (
            <>
              {" "}
              <span className="brand-italic text-[var(--brand-gold)]">{firstName}</span>
            </>
          ) : null}
        </h2>
        <p className="text-muted-foreground">
          Ce qu&apos;il se passe sur le portefeuille — {clientsCount.length} client
          {clientsCount.length > 1 ? "s" : ""} actifs.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-[1fr_minmax(280px,360px)]">
        {/* === Left column: unified to-do === */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckSquare size={16} className="text-[var(--brand-gold)]" />
                  À faire
                  {totalTodos > 0 && (
                    <Badge
                      variant="outline"
                      className="border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] text-[var(--brand-gold)]"
                    >
                      {totalTodos}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Tâches manuelles + étapes de production non terminées.
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/tasks">
                  Tout voir
                  <ArrowRight size={14} />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {totalTodos === 0 ? (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Tout est en ordre. Rien à faire côté portefeuille client.
                </p>
              ) : (
                <ul className="space-y-2">
                  {todoItems.slice(0, 20).map((item) => {
                    const isStep = item.kind === "step"
                    const isInProgress = isStep && item.status === "in_progress"
                    return (
                      <li
                        key={item.id}
                        className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                      >
                        {isStep ? (
                          <StepQuickToggle
                            stepId={item.stepId}
                            clientId={item.clientId}
                          />
                        ) : (
                          <TaskQuickToggle taskId={item.id.replace(/^task-/, "")} />
                        )}
                        <div className="flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.title}</p>
                            {isStep ? (
                              <Badge
                                variant="outline"
                                className={
                                  isInProgress
                                    ? "border-amber-500/30 bg-amber-500/10 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300"
                                    : "border-zinc-500/30 bg-zinc-500/10 text-[10px] uppercase tracking-wider text-muted-foreground"
                                }
                              >
                                {isInProgress ? "En cours" : "Étape"}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] text-[10px] uppercase tracking-wider text-[var(--brand-gold)]"
                              >
                                Tâche
                              </Badge>
                            )}
                          </div>
                          {!isStep && item.description && (
                            <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/admin/clients/${item.clientId}`}
                          className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {item.clientName}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* === Right column: notifications + quick actions === */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell size={16} className="text-[var(--brand-gold)]" />
                Activité récente
              </CardTitle>
              <CardDescription>Actions des clients sur leur espace.</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Aucune activité pour l&apos;instant.
                </p>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((n) => {
                    const Icon =
                      n.kind === "pub_intake"
                        ? Sparkles
                        : n.kind === "formation_intake"
                          ? FileUp
                          : n.kind === "file_upload"
                            ? UploadCloud
                            : n.kind === "card_confirmed"
                              ? CreditCard
                              : n.kind === "invite_sent"
                                ? UserPlus
                                : KeyRound
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          className="flex gap-3 rounded-md border border-border bg-card/50 p-3 transition-colors hover:border-[var(--brand-gold-border)] hover:bg-card"
                        >
                          <Icon
                            size={16}
                            className="mt-0.5 shrink-0 text-[var(--brand-gold)]"
                          />
                          <div className="flex-1 space-y-0.5">
                            <p className="text-sm font-medium leading-snug">
                              {n.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(n.createdAt)}
                              {n.meta ? ` · ${n.meta}` : ""}
                            </p>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/admin/clients">
                  Gérer les clients
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/clients/new">
                  Nouveau client
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

// =============================================================================
// Client dashboard — onboarding progression + tabs
// =============================================================================
type ClientDashboardProps = {
  firstName: string | null | undefined
  email: string | null
  userId: string | null
  user: Awaited<ReturnType<typeof currentUser>>
}

async function ClientDashboard({ firstName, email, userId, user }: ClientDashboardProps) {
  let clientRow: Client | null = null
  let steps: OnboardingStep[] = []
  let files: ClientFile[] = []
  let access: ClientAccess | null = null
  let intake: ClientIntake | null = null
  let formationIntake: ClientFormationIntake | null = null

  if (email) {
    const [row] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, email.toLowerCase()))
    clientRow = row ?? null

    if (clientRow) {
      if (user && clientRow.clerkUserId !== user.id) {
        await db
          .update(clients)
          .set({
            clerkUserId: user.id,
            status: clientRow.status === "archived" ? "archived" : "active",
            updatedAt: new Date(),
          })
          .where(eq(clients.id, clientRow.id))
        clientRow = {
          ...clientRow,
          clerkUserId: user.id,
          status: clientRow.status === "archived" ? "archived" : "active",
        }
      }

      steps = await db
        .select()
        .from(onboardingSteps)
        .where(eq(onboardingSteps.clientId, clientRow.id))
        .orderBy(asc(onboardingSteps.stepOrder))

      if (steps.length === 0) {
        await seedDefaultSteps(clientRow.id)
        steps = await db
          .select()
          .from(onboardingSteps)
          .where(eq(onboardingSteps.clientId, clientRow.id))
          .orderBy(asc(onboardingSteps.stepOrder))
      }

      files = await db
        .select()
        .from(clientFiles)
        .where(eq(clientFiles.clientId, clientRow.id))
        .orderBy(desc(clientFiles.createdAt))

      const [accessRow] = await db
        .select()
        .from(clientAccess)
        .where(eq(clientAccess.clientId, clientRow.id))
      access = accessRow ?? null

      const [intakeRow] = await db
        .select()
        .from(clientIntake)
        .where(eq(clientIntake.clientId, clientRow.id))
      intake = intakeRow ?? null

      const [formationIntakeRow] = await db
        .select()
        .from(clientFormationIntake)
        .where(eq(clientFormationIntake.clientId, clientRow.id))
      formationIntake = formationIntakeRow ?? null
    }
  }

  const decryptedAccess = access
    ? {
        facebookEmail: access.facebookEmail,
        facebookPassword: decrypt(access.facebookPasswordEnc) || null,
        instagramEmail: access.instagramEmail,
        instagramPassword: decrypt(access.instagramPasswordEnc) || null,
        notes: access.notes,
      }
    : null

  const hasPub = clientRow?.services.includes("pub") ?? false
  const hasFormation = clientRow?.services.includes("formation") ?? false
  const needsBrief = hasPub && !intake?.completedAt
  const needsAdAccountChoice =
    hasPub &&
    // Considered done only when the client has confirmed either route
    !(
      (clientRow?.adAccountPreference === "invite" &&
        Boolean(clientRow?.adAccountInviteConfirmedAt)) ||
      (clientRow?.adAccountPreference === "create" &&
        Boolean(access?.facebookPasswordEnc) &&
        Boolean(access?.instagramPasswordEnc))
    )
  const needsLivret = hasFormation && !formationIntake?.completedAt
  const shouldShowIntake =
    clientRow && (needsBrief || needsAdAccountChoice || needsLivret)
  // Card-add modal: admin has confirmed ad account creation + client hasn't added their card yet.
  // Only after the intake has been taken care of, to avoid stacking blocking modals.
  const shouldShowCardModal =
    !shouldShowIntake &&
    clientRow &&
    hasPub &&
    Boolean(clientRow.adAccountCreatedAt) &&
    Boolean(clientRow.adAccountName) &&
    !clientRow.adAccountCardConfirmedAt

  const doneCount = steps.filter((s) => s.status === "done").length
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12 md:py-16">
      {shouldShowCardModal && clientRow && clientRow.adAccountName && (
        <CardAddModal
          clientId={clientRow.id}
          adAccountName={clientRow.adAccountName}
        />
      )}
      {shouldShowIntake && clientRow && (
        <IntakeModal
          clientId={clientRow.id}
          clientName={firstName || clientRow.name || ""}
          needsPub={hasPub}
          needsFormation={needsLivret}
          needsBrief={needsBrief}
          needsAdAccountChoice={needsAdAccountChoice}
          initialPreference={
            (clientRow.adAccountPreference as "invite" | "create" | null) ?? null
          }
          initial={{
            brandName: intake?.brandName ?? clientRow.company ?? null,
            targetAudience: intake?.targetAudience ?? null,
            topProblems: intake?.topProblems ?? null,
            offerDifferentiator: intake?.offerDifferentiator ?? null,
            topBenefits: intake?.topBenefits ?? null,
            commonObjections: intake?.commonObjections ?? null,
            objectionResponses: intake?.objectionResponses ?? null,
            brandStory: intake?.brandStory ?? null,
            bestResults: intake?.bestResults ?? null,
            currentOffer: intake?.currentOffer ?? null,
          }}
          existingLivret={
            formationIntake?.livretUrl && formationIntake.livretName
              ? { url: formationIntake.livretUrl, name: formationIntake.livretName }
              : null
          }
        />
      )}

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Expansion Agency
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          </div>
        </div>
        <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
      </header>

      <section className="space-y-2">
        <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Bonjour
          {firstName ? (
            <>
              {" "}
              <span className="brand-italic text-[var(--brand-gold)]">{firstName}</span>
            </>
          ) : null}
        </h2>
        {clientRow ? (
          <p className="text-muted-foreground">
            Voici votre espace de production avec Expansion.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Votre espace arrive. Votre gestionnaire va finaliser votre onboarding.
          </p>
        )}
      </section>

      {clientRow && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progression globale</CardTitle>
                <CardDescription>
                  {doneCount} étape{doneCount > 1 ? "s" : ""} sur {steps.length}{" "}
                  {steps.length > 1 ? "terminées" : "terminée"}
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

            <ShootDateReadonly date={clientRow.shootDate} />
          </div>

          <Tabs defaultValue="steps">
            <TabsList>
              <TabsTrigger value="steps">
                <ListChecks size={14} />
                Étapes
              </TabsTrigger>
              <TabsTrigger value="files">
                <FileText size={14} />
                Mes fichiers
                {files.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {files.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="access">
                <KeyRound size={14} />
                Mes accès
              </TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="space-y-3">
              {steps.map((step, idx) => {
                const description = getStepDescription(step.title)
                const Icon =
                  step.status === "done"
                    ? CheckCircle2
                    : step.status === "in_progress"
                      ? Loader2
                      : Circle
                const iconClass =
                  step.status === "done"
                    ? "text-emerald-500"
                    : step.status === "in_progress"
                      ? "text-amber-500 animate-spin"
                      : "text-muted-foreground"
                const statusBadge =
                  step.status === "done"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : step.status === "in_progress"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"

                return (
                  <Card key={step.id}>
                    <CardContent className="flex items-start gap-4 pt-6">
                      <Icon size={22} className={`mt-0.5 shrink-0 ${iconClass}`} aria-hidden />
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            Étape {idx + 1} — {step.title}
                          </p>
                          <Badge variant="outline" className={statusBadge}>
                            {STEP_STATUS_LABELS[step.status]}
                          </Badge>
                        </div>
                        {description && (
                          <p className="text-sm text-muted-foreground">
                            {description}
                          </p>
                        )}
                        {step.notes && (
                          <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
                            {step.notes}
                          </blockquote>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vos fichiers</CardTitle>
                  <CardDescription>
                    Déposez ici votre broll, vos briefs, vos visuels. L&apos;agence
                    y accède immédiatement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Uploader
                    clientId={clientRow.id}
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
                  <CardTitle className="text-base">Vos accès publicitaires</CardTitle>
                  <CardDescription>
                    Renseignez ici vos identifiants Business Manager, Pixel et
                    comptes sociaux. Pas de mots de passe — l&apos;agence vous
                    demandera une invitation native sur les plateformes qui le
                    nécessitent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AccessForm clientId={clientRow.id} access={decryptedAccess} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  )
}
