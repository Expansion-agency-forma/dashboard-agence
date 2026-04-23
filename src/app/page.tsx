import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, CheckCircle2, Clock } from "lucide-react"

const ROADMAP: Array<{ slice: string; status: "done" | "next" | "later"; detail: string }> = [
  { slice: "0 — Scaffolding", status: "done", detail: "Next.js 15 · Tailwind · shadcn · Vercel" },
  { slice: "1 — Auth", status: "next", detail: "Clerk magic link · roles agency / client" },
  { slice: "2 — Clients", status: "later", detail: "Admin CRUD · invitation client" },
  { slice: "3 — Onboarding tracker", status: "later", detail: "Script → Tournage → Montage → Lancement" },
  { slice: "4 — Uploads", status: "later", detail: "Broll vers Drive · accès Meta Business" },
]

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16 md:py-24">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#170000] text-[#c9a84c]">
            <span className="text-lg font-bold tracking-tight">E</span>
            <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#c9a84c]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expansion Agency</p>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard interne</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" disabled>
          Connexion bientôt
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Chantier en cours</CardTitle>
          <CardDescription>
            Espace d&apos;onboarding pour les clients de l&apos;agence —
            suivi de production, dépôts de fichiers, accès publicitaires.
            Construction par slices verticales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {ROADMAP.map((item) => (
              <li key={item.slice} className="flex items-start gap-3 py-3">
                <span
                  className={
                    item.status === "done"
                      ? "mt-0.5 text-emerald-500"
                      : item.status === "next"
                      ? "mt-0.5 text-amber-500"
                      : "mt-0.5 text-muted-foreground"
                  }
                  aria-hidden
                >
                  {item.status === "done" ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Clock size={18} />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.slice}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <span className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                  {item.status === "done"
                    ? "livré"
                    : item.status === "next"
                    ? "en cours"
                    : "à venir"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <footer className="flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} The Expansion Agency · Interne</span>
        <a
          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          href="https://www.expansion-agency.com"
          target="_blank"
          rel="noreferrer"
        >
          Site public
          <ArrowUpRight size={12} />
        </a>
      </footer>
    </main>
  )
}
