import Link from "next/link"
import { db } from "@/db/client"
import { clients } from "@/db/schema"
import { desc } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Users } from "lucide-react"

export const dynamic = "force-dynamic"

const statusStyles: Record<string, string> = {
  invited: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  archived: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
}

const statusLabels: Record<string, string> = {
  invited: "Invité",
  active: "Actif",
  archived: "Archivé",
}

export default async function ClientsPage() {
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt))

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les organismes accompagnés et leurs invitations au dashboard.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clients/new">
            <Plus size={16} />
            Nouveau client
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-16 text-center">
          <Users size={36} className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Aucun client pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground">
              Invite ton premier client pour qu&apos;il accède à son espace.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/clients/new">
              <Plus size={16} />
              Créer un client
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organisme</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Créé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.company ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[c.status]}>
                      {statusLabels[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(c.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
