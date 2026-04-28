import Link from "next/link"
import { db } from "@/db/client"
import { quotes } from "@/db/schema"
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
import { FileText, Plus } from "lucide-react"
import { formationPriceCents, formatEuros } from "@/lib/pricing"

export const dynamic = "force-dynamic"

const statusStyles: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  sent: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20",
}
const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
}

function quoteTotalCents(q: {
  services: string[]
  formationDays: number | null
  formationTravelCents: number | null
}): number {
  let total = 0
  if (q.services.includes("formation") && q.formationDays) {
    total += formationPriceCents(q.formationDays)
    total += q.formationTravelCents ?? 0
  }
  return total
}

function servicesLabel(services: string[]): string {
  const parts: string[] = []
  if (services.includes("pub")) parts.push("Pub")
  if (services.includes("formation")) parts.push("Formation")
  return parts.join(" + ")
}

export default async function QuotesPage() {
  const rows = await db.select().from(quotes).orderBy(desc(quotes.createdAt))

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">
            Génère un devis pour un prospect — il pourra l&apos;accepter en ligne
            et son espace sera créé automatiquement.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/quotes/new">
            <Plus size={16} />
            Nouveau devis
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-16 text-center">
          <FileText size={36} className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Aucun devis pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground">
              Crée ton premier devis pour partager une proposition à un prospect.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/quotes/new">
              <Plus size={16} />
              Nouveau devis
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Prestations</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Expire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => {
                const total = quoteTotalCents(q)
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/quotes/${q.id}`}
                        className="transition-colors hover:text-primary"
                      >
                        {q.prospectName}
                      </Link>
                      {(q.prospectCompany || q.prospectDomain) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {[q.prospectCompany, q.prospectDomain]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.prospectEmail}
                    </TableCell>
                    <TableCell className="text-sm">
                      {servicesLabel(q.services)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {total > 0 ? formatEuros(total) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[q.status]}>
                        {statusLabels[q.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(q.expiresAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
