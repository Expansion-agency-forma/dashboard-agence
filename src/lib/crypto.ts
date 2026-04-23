import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * AES-256-GCM encryption at rest for sensitive client fields
 * (FB/IG passwords). The key is a 32-byte value stored as base64
 * in the ENCRYPTION_KEY env var — never committed.
 *
 * Storage format: "v1:<iv_b64>:<auth_tag_b64>:<ciphertext_b64>"
 * The "v1:" prefix lets us rotate the algorithm later if needed.
 */

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12 // GCM recommended nonce length
const PREFIX = "v1:"

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set — cannot encrypt/decrypt sensitive fields",
    )
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`,
    )
  }
  cachedKey = key
  return key
}

export function encrypt(plaintext: string): string {
  if (plaintext === "") return ""
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`
}

export function decrypt(ciphertext: string | null | undefined): string {
  if (!ciphertext) return ""
  if (!ciphertext.startsWith(PREFIX)) {
    // Legacy / accidental plaintext — return as-is for graceful degradation
    return ciphertext
  }
  const [, payload] = ciphertext.split(PREFIX)
  const [ivB64, tagB64, encB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error("Malformed ciphertext")
  }
  const key = getKey()
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const enc = Buffer.from(encB64, "base64")
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString("utf8")
}
