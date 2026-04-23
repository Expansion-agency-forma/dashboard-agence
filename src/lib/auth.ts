import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export type Role = "agency" | "client"

function agencyAllowlist(): string[] {
  const raw = process.env.AGENCY_EMAILS ?? ""
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAgencyEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return agencyAllowlist().includes(email.toLowerCase())
}

/**
 * Resolve the current user's role based on their Clerk email.
 * Returns null if the user is not signed in.
 */
export async function getRole(): Promise<Role | null> {
  const user = await currentUser()
  if (!user) return null
  const email = user.emailAddresses[0]?.emailAddress
  return isAgencyEmail(email) ? "agency" : "client"
}

/**
 * Ensure the current request is from an agency user. Redirects otherwise.
 */
export async function requireAgency() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const role = await getRole()
  if (role !== "agency") redirect("/dashboard")
  const user = await currentUser()
  return { userId, user: user! }
}
