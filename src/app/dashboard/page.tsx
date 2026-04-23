import Link from "next/link"
import { currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, ArrowRight } from "lucide-react"
import { getRole } from "@/lib/auth"

const NEXT_SLICES = [
  { title: "Slice 2 — Clients", detail: "Liste, création, invitation par magic link" },
  { title: "Slice 3 — Tracker", detail: "Étapes Script → Tournage → Montage → Lancement" },
  { title: "Slice 4 — Uploads", detail: "Broll vers Drive, formulaire d'accès Meta" },
]

export default async function DashboardPage() {
  const user = await currentUser()
  const role = await getRole()
  const firstName = user?.firstName
  const greeting = firstName
    ? `Bonjour ${firstName}`
    : user?.emailAddresses[0]?.emailAddress
      ? `Bonjour ${user.emailAddresses[0].emailAddress}`
      : "Bonjour"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-12 md:py-16">
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
        <p className="text-muted-foreground">
          {role === "agency"
            ? "Accès admin activé. Gère les clients depuis l'espace dédié."
            : "Ton espace d'onboarding arrive dans la prochaine slice."}
        </p>
      </section>

      {role === "agency" && (
        <Card>
          <CardHeader>
            <CardTitle>Espace admin</CardTitle>
            <CardDescription>
              Liste des clients, création, invitation par email.
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

      <Card>
        <CardHeader>
          <CardTitle>Suite de la construction</CardTitle>
          <CardDescription>Slices à venir, livrées une par une</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {NEXT_SLICES.map((slice) => (
              <li key={slice.title} className="flex items-start gap-3 py-3">
                <Clock size={18} className="mt-0.5 text-muted-foreground" aria-hidden />
                <div className="flex-1">
                  <p className="text-sm font-medium">{slice.title}</p>
                  <p className="text-sm text-muted-foreground">{slice.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
