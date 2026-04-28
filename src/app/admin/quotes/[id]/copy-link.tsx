"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard not available — silent
    }
  }

  return (
    <Button onClick={copy} size="sm" variant="outline">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copié" : "Copier"}
    </Button>
  )
}
