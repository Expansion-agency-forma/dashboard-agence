import { SignIn } from "@clerk/nextjs"
import Link from "next/link"

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <Link
        href="/"
        className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#170000] text-[#c9a84c]">
          <span className="text-base font-bold">E</span>
          <span className="absolute right-1.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#c9a84c]" />
        </div>
        <span>Expansion Agency — Dashboard</span>
      </Link>

      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "shadow-lg border border-border",
          },
        }}
      />
    </main>
  )
}
