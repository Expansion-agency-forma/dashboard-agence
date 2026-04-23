import Link from "next/link"
import { currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { db } from "@/db/client"
import { clients, onboardingSteps, type Client, type OnboardingStep } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
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
import { ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { getRole } from "@/lib/auth"
import { getStepDescription, STEP_STATUS_LABELS } from "@/lib/onboarding"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await currentUser()
  const role = await getRole()
  const firstName = user?.firstName
  const email = user?.emailAddresses[0]?.emailAddress ?? null
  const greeting = firstName
    ? `Bonjour ${firstName}`
    : email
      ? `Bonjour ${email}`
      : "Bonjour"

  // Client view — look up their client row and steps
  let clientRow: Client | null = null
  let steps: OnboardingStep[] = []
  if (role === "client" && email) {
    clientRow = await getClientByEmail(email)

    if (clientRow) {
      // First visit after invitation: link the Clerk user + flip to "active"
      if (user && clientRow.clerkUserId !== user.id) {
        await db
          .update(clients)
          .set({
            clerkUserId: user.id,
            status: clientRow.status === "archived" ? "archived" : "active",
            updatedAt: new Date(),
          })
          .where(eq(clients.id, clientRow.id))
        clientRow = { ...clientRow, clerkUserId: user.id, status: clientRow.status === "archived" ? "archived" : "active" }
      }
      steps = await getStepsForClient(clientRow.id)
    }
  }

  const doneCount = steps.filter((s) => s.status === "done").length
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12 md:py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#170000] text-[#c9a84c]">
            <span className="text-lg font-bold tracking-tight">E</span>
            <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#c9a84c]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expansion Agency</p>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          </div>
        </div>
        <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
      </header>

      <section className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">{greeting} 👋</h2>
        {role === "agency" ? (
          <p className="text-muted-foreground">
            Accès admin activé. Gère les clients depuis l&apos;espace dédié.
          </p>
        ) : clientRow ? (
          <p className="text-muted-foreground">
            Voici l&apos;avancement de votre projet avec Expansion.
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
              Liste des clients, création, invitation par email, suivi des étapes.
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

          <section className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight">
              Étapes de production
            </h3>
            <div className="space-y-3">
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
            </div>
          </section>
        </>
      )}
    </main>
  )
}

async function getClientByEmail(email: string) {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email.toLowerCase()))
  return row ?? null
}

async function getStepsForClient(clientId: string) {
  return db
    .select()
    .from(onboardingSteps)
    .where(eq(onboardingSteps.clientId, clientId))
    .orderBy(asc(onboardingSteps.stepOrder))
}
