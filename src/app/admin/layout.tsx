import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { requireAgency } from "@/lib/auth"
import { Users, LayoutDashboard } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAgency()

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-background">
      <aside className="flex flex-col border-r border-sidebar-border bg-sidebar p-4">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <BrandMark size="sm" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Expansion
            </span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/admin/clients"
            className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Users size={16} />
            Clients
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LayoutDashboard size={16} />
            Mon dashboard
          </Link>
        </nav>

        <div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-border bg-background/80 p-2">
          <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          <span className="truncate text-xs uppercase tracking-wider text-muted-foreground">
            agency
          </span>
        </div>
      </aside>

      <section className="flex flex-col">{children}</section>
    </div>
  )
}
