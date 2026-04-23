import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Calendar } from "lucide-react"

type Props = {
  date: Date | null
}

function formatDisplay(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

function daysUntil(date: Date): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return "Demain"
  if (diff === -1) return "Hier"
  if (diff > 0) return `dans ${diff} jour${diff > 1 ? "s" : ""}`
  return `il y a ${Math.abs(diff)} jour${Math.abs(diff) > 1 ? "s" : ""}`
}

export function ShootDateReadonly({ date }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar size={16} className="text-[var(--brand-gold)]" />
          Date de tournage
        </CardTitle>
        {!date && (
          <CardDescription>
            Pas encore programmée — votre gestionnaire vous préviendra.
          </CardDescription>
        )}
      </CardHeader>
      {date && (
        <CardContent>
          <p className="text-2xl font-semibold tracking-tight">
            <span className="brand-italic text-[var(--brand-gold)]">
              {formatDisplay(date).charAt(0).toUpperCase() +
                formatDisplay(date).slice(1)}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{daysUntil(date)}</p>
        </CardContent>
      )}
    </Card>
  )
}
