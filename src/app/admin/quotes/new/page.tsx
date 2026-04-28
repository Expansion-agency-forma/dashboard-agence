import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { NewQuoteForm } from "./form"

export default function NewQuotePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-auto px-2 py-1">
            <Link href="/admin/quotes">
              <ArrowLeft size={14} />
              Devis
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Nouveau devis</h1>
          <p className="text-sm text-muted-foreground">
            Crée un devis pour un prospect. Une fois créé, tu pourras le partager
            via un lien public ou un PDF.
          </p>
        </div>
      </header>

      <div className="max-w-2xl">
        <NewQuoteForm />
      </div>
    </div>
  )
}
