import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { NewClientForm } from "./form"

export default function NewClientPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-auto px-2 py-1">
            <Link href="/admin/clients">
              <ArrowLeft size={14} />
              Clients
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Nouveau client</h1>
          <p className="text-sm text-muted-foreground">
            Crée le client et envoie-lui son invitation par email.
          </p>
        </div>
      </header>

      <div className="max-w-xl">
        <NewClientForm />
      </div>
    </div>
  )
}
