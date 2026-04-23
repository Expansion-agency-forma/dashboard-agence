"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react"
import {
  createTaskAction,
  deleteTaskAction,
  toggleTaskAction,
} from "./tasks-actions"

type TaskRow = {
  id: string
  title: string
  description: string | null
  done: boolean
  createdAt: Date
  completedAt: Date | null
}

type Props = {
  clientId: string
  tasks: TaskRow[]
}

export function TasksPanel({ clientId, tasks }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()

  const pendingTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)

  const onCreate = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    startTransition(async () => {
      try {
        await createTaskAction({
          clientId,
          title: trimmed,
          description: description.trim() || undefined,
        })
        setTitle("")
        setDescription("")
        setShowForm(false)
      } catch (err) {
        console.error(err)
      }
    })
  }

  const onToggle = (taskId: string, nextDone: boolean) => {
    startTransition(async () => {
      try {
        await toggleTaskAction(taskId, nextDone)
      } catch (err) {
        console.error(err)
      }
    })
  }

  const onDelete = (taskId: string) => {
    if (!confirm("Supprimer cette tâche ?")) return
    startTransition(async () => {
      try {
        await deleteTaskAction(taskId)
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <div className="space-y-5">
      {showForm ? (
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Titre</Label>
            <Input
              id="task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Briefer le monteur sur la V2 du module 3"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onCreate()
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Détails (optionnel)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte, liens, deadlines…"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onCreate}
              disabled={pending || !title.trim()}
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Ajouter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false)
                setTitle("")
                setDescription("")
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus size={14} />
          Nouvelle tâche
        </Button>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          À faire ({pendingTasks.length})
        </h3>
        {pendingTasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune tâche en attente sur ce client.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={(v) => onToggle(t.id, v === true)}
                  aria-label="Marquer comme terminée"
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description && (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(t.id)}
                  disabled={pending}
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {doneTasks.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Terminées ({doneTasks.length})
          </h3>
          <ul className="space-y-2">
            {doneTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-md border border-border bg-card/50 p-3 opacity-70"
              >
                <Checkbox
                  checked={true}
                  onCheckedChange={(v) => onToggle(t.id, v === true)}
                  aria-label="Remettre à faire"
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium line-through">{t.title}</p>
                  {t.completedAt && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      Terminée le{" "}
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(t.completedAt)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(t.id)}
                  disabled={pending}
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
