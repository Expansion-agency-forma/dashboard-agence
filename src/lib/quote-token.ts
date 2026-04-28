import { randomBytes } from "node:crypto"

/** URL-safe random token used in `/q/<token>` public quote links. */
export function generateQuoteToken(): string {
  // 18 bytes → 24 chars in base64url (no padding).
  return randomBytes(18).toString("base64url")
}
