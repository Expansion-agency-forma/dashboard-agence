"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Download size={14} />
      Télécharger en PDF
    </Button>
  )
}
