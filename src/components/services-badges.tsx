import { Badge } from "@/components/ui/badge"
import { Megaphone, GraduationCap } from "lucide-react"
import { SERVICE_LABELS, type ServiceType } from "@/db/schema"

const ICON: Record<ServiceType, typeof Megaphone> = {
  pub: Megaphone,
  formation: GraduationCap,
}

export function ServicesBadges({ services }: { services: string[] | ServiceType[] }) {
  const items = (services as ServiceType[]).filter(
    (s): s is ServiceType => s === "pub" || s === "formation",
  )
  if (items.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Aucune prestation</span>
    )
  }
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {items.map((s) => {
        const Icon = ICON[s]
        return (
          <Badge
            key={s}
            variant="outline"
            className="gap-1 border-[var(--brand-gold-border)] bg-[var(--brand-gold-soft)] text-[var(--brand-gold)]"
          >
            <Icon size={12} />
            {SERVICE_LABELS[s]}
          </Badge>
        )
      })}
    </div>
  )
}
