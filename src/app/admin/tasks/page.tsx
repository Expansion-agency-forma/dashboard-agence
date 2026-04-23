import Link from "next/link"
import { db } from "@/db/client"
import { adminTasks, clients } from "@/db/schema"
import { and, asc, desc, eq } from "drizzle-orm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, CheckSquare } from "lucide-react"
import { TaskQuickToggle } from "./task-quick-toggle"

export const dynamic = "force-dynamic"

export default async function GlobalTasksPage() {
  const pendingTasks = await db
    .select({
      id: adminTasks.id,
      title: adminTasks.title,
      description: adminTasks.description,
      createdAt: adminTasks.createdAt,
      clientId: clients.id,
      clientName: clients.name,
      clientEmail: clients.email,
    })
    .from(adminTasks)
    .innerJoin(clients, eq(adminTasks.clientId, clients.id))
    .where(eq(adminTasks.done, false))
    .orderBy(asc(adminTasks.createdAt))

  const recentlyDone = await db
    .select({
      id: adminTasks.id,
      title: adminTasks.title,
      completedAt: adminTasks.completedAt,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(adminTasks)
    .innerJoin(clients, eq(adminTasks.clientId, clients.id))
    .where(eq(adminTasks.done, true))
    .orderBy(desc(adminTasks.completedAt))
    .limit(8)

  // Group pending by client
  const byClient = pendingTasks.reduce<
    Record<
      string,
      {
        clientId: string
        clientName: string
        clientEmail: string
        tasks: typeof pendingTasks
      }
    >
  >((acc, t) => {
    if (!acc[t.clientId]) {
      acc[t.clientId] = {
        clientId: t.clientId,
        clientName: t.clientName,
        clientEmail: t.clientEmail,
        tasks: [],
      }
    }
    acc[t.clientId].tasks.push(t)
    return acc
  }, {})
  const groups = Object.values(byClient)

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            À faire <span className="brand-italic text-[var(--brand-gold)]">tous clients</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Ce qu&apos;il reste à faire sur l&apos;ensemble du portefeuille client.
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <div>
              <p className="font-medium">Rien à faire, tout est à jour 🎉</p>
              <p className="text-sm text-muted-foreground">
                Ouvre une fiche client pour ajouter une nouvelle tâche.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.clientId}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{group.clientName}</CardTitle>
                  <CardDescription>{group.clientEmail}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/clients/${group.clientId}`}>
                    Ouvrir
                    <ArrowRight size={14} />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {group.tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                    >
                      <TaskQuickToggle taskId={t.id} />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{t.title}</p>
                        {t.description && (
                          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recentlyDone.length > 0 && (
        <section className="space-y-3 pt-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Récemment terminées
          </h2>
          <ul className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
            {recentlyDone.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span className="line-through">{t.title}</span>
                </div>
                <Link
                  href={`/admin/clients/${t.clientId}`}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t.clientName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
