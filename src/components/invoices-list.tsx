"use client"

import { Badge } from "@/components/ui/badge"
import { Download, ExternalLink, Receipt } from "lucide-react"
import { formatEuros, formatPeriodMonth } from "@/lib/pricing"

export type InvoiceListItem = {
  id: string
  serviceType: string // "pub" | "formation"
  periodMonth: string | null
  amountCents: number
  status: "open" | "paid" | "uncollectible" | "void"
  stripeInvoiceNumber: string | null
  stripeHostedInvoiceUrl: string | null
  stripeInvoicePdfUrl: string | null
  issuedAt: Date
  paidAt: Date | null
}

const statusStyle: Record<InvoiceListItem["status"], string> = {
  open: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  uncollectible: "border-destructive/30 bg-destructive/10 text-destructive",
  void: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
}
const statusLabel: Record<InvoiceListItem["status"], string> = {
  open: "À payer",
  paid: "Payée",
  uncollectible: "Impayée",
  void: "Annulée",
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

function describe(invoice: InvoiceListItem): string {
  if (invoice.serviceType === "pub" && invoice.periodMonth) {
    return `Pub — ${formatPeriodMonth(invoice.periodMonth)}`
  }
  if (invoice.serviceType === "formation") {
    return "Formation en ligne"
  }
  if (invoice.serviceType === "deposit") {
    return "Acompte — Formation"
  }
  return invoice.serviceType
}

type Props = {
  invoices: InvoiceListItem[]
  /** When true, show the "Pay" CTA prominently for `open` invoices (client view). */
  showPayCta?: boolean
}

export function InvoicesList({ invoices, showPayCta = false }: Props) {
  if (invoices.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Aucune facture pour le moment.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {invoices.map((inv) => (
        <li
          key={inv.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-4"
        >
          <div className="flex items-start gap-3">
            <Receipt size={18} className="mt-0.5 text-[var(--brand-gold)]" />
            <div className="space-y-0.5">
              <p className="font-medium first-letter:uppercase">
                {describe(inv)}
                {inv.stripeInvoiceNumber && (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {inv.stripeInvoiceNumber}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatEuros(inv.amountCents)} · émise le {formatDate(inv.issuedAt)}
                {inv.paidAt && <> · payée le {formatDate(inv.paidAt)}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusStyle[inv.status]}>
              {statusLabel[inv.status]}
            </Badge>
            {inv.stripeInvoicePdfUrl && (
              <a
                href={inv.stripeInvoicePdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Download size={12} />
                PDF
              </a>
            )}
            {inv.stripeHostedInvoiceUrl && inv.status === "open" && showPayCta ? (
              <a
                href={inv.stripeHostedInvoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-gold)] px-3 py-1.5 text-xs font-semibold text-[#170000] transition-colors hover:bg-[var(--brand-gold)]/90"
              >
                Payer
                <ExternalLink size={12} />
              </a>
            ) : (
              inv.stripeHostedInvoiceUrl && (
                <a
                  href={inv.stripeHostedInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink size={12} />
                  Voir
                </a>
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
