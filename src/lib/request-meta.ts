import { headers } from "next/headers"

/**
 * Best-effort client IP extraction from request headers. Returns null when
 * none of the standard headers are present. Used as audit trail evidence
 * for electronic signatures (eIDAS SES).
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  // Vercel sets x-vercel-forwarded-for, otherwise standard headers.
  const candidates = [
    h.get("x-vercel-forwarded-for"),
    h.get("x-forwarded-for"),
    h.get("x-real-ip"),
    h.get("cf-connecting-ip"),
  ]
  for (const c of candidates) {
    if (!c) continue
    const first = c.split(",")[0]?.trim()
    if (first) return first
  }
  return null
}

/** Truncated user agent string (max 500 chars) for storage. */
export async function getUserAgent(): Promise<string | null> {
  const h = await headers()
  const ua = h.get("user-agent")
  if (!ua) return null
  return ua.length > 500 ? ua.slice(0, 500) : ua
}
