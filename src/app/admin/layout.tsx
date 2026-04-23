import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { requireAgency } from "@/lib/auth"
import { Users, LayoutDashboard } from "lucide-react"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAgency()

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-r border-border bg-card p-4">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#170000] text-[#c9a84c]">
            <span className="text-base font-bold">E</span>
            <span className="absolute right-1.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#c9a84c]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Expansion</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/admin/clients"
            className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Users size={16} />
            Clients
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LayoutDashboard size={16} />
            Mon dashboard
          </Link>
        </nav>

        <div className="mt-auto flex items-center justify-between gap-2 rounded-md border border-border bg-background p-2">
          <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          <span className="truncate text-xs text-muted-foreground">agency</span>
        </div>
      </aside>

      <section className="flex flex-col">{children}</section>
    </div>
  )
}
