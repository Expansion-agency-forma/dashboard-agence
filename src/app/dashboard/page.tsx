import Link from "next/link"
import { auth, currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { db } from "@/db/client"
import {
  clientAccess,
  clientFiles,
  clientIntake,
  clients,
  onboardingSteps,
  type Client,
  type OnboardingStep,
  type ClientFile,
  type ClientAccess,
  type ClientIntake,
} from "@/db/schema"
import { asc, desc, eq } from "drizzle-orm"
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
  CheckCircle2,
  Circle,
  FileText,
  KeyRound,
  ListChecks,
  Loader2,
} from "lucide-react"
import { getRole } from "@/lib/auth"
import { getStepDescription, seedDefaultSteps, STEP_STATUS_LABELS } from "@/lib/onboarding"
import { Uploader } from "@/components/uploader"
import { AccessForm } from "@/components/access-form"
import { BrandMark } from "@/components/brand-mark"
import { IntakeModal } from "@/components/intake-modal"
import { decrypt } from "@/lib/crypto"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await currentUser()
  const role = await getRole()
  const firstName = user?.firstName
  const email = user?.emailAddresses[0]?.emailAddress ?? null
  const greeting = firstName
    ? firstName
    : email
      ? email
      : null
  // keep unused variable for future compatibility (used by subtitle logic)
  void greeting

  let clientRow: Client | null = null
  let steps: OnboardingStep[] = []
  let files: ClientFile[] = []
  let access: ClientAccess | null = null
  let intake: ClientIntake | null = null

  if (role === "client" && email) {
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

  const doneCount = steps.filter((s) => s.status === "done").length
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  const shouldShowIntake =
    role === "client" &&
    clientRow &&
    clientRow.services.includes("pub") &&
    !intake?.completedAt

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12 md:py-16">
      {shouldShowIntake && clientRow && (
        <IntakeModal
          clientId={clientRow.id}
          clientName={firstName || clientRow.name || ""}
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
              <span className="brand-italic text-[var(--brand-gold)]">
                {firstName}
              </span>
            </>
          ) : null}
        </h2>
        {role === "agency" ? (
          <p className="text-muted-foreground">
            Accès admin activé. Gère les clients depuis l&apos;espace dédié.
          </p>
        ) : clientRow ? (
          <p className="text-muted-foreground">
            Voici votre espace de production avec Expansion.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Votre espace arrive. Votre gestionnaire va finaliser votre onboarding.
          </p>
        )}
      </section>

      {role === "agency" && (
        <Card>
          <CardHeader>
            <CardTitle>Espace admin</CardTitle>
            <CardDescription>
              Liste des clients, création, invitation par email, suivi des étapes,
              fichiers et accès publicitaires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/clients">
                Gérer les clients
                <ArrowRight size={16} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {role === "client" && clientRow && (
        <>
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
