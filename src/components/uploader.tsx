"use client"

import { useRef, useState, useTransition } from "react"
import { upload } from "@vercel/blob/client"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  File as FileIcon,
  FileVideo,
  FileImage,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import { registerFileAction, deleteFileAction } from "@/app/admin/clients/[id]/files-actions"

type StoredFile = {
  id: string
  name: string
  url: string
  size: number
  contentType: string | null
  createdAt: Date
  uploadedBy: string
}

type Props = {
  clientId: string
  files: StoredFile[]
  currentUserId: string
  readOnly?: boolean
}

type Progress = {
  id: string
  name: string
  loaded: number
  total: number
  error?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`
}

function IconForFile({ contentType }: { contentType: string | null }) {
  if (!contentType) return <FileIcon size={18} />
  if (contentType.startsWith("video/")) return <FileVideo size={18} />
  if (contentType.startsWith("image/")) return <FileImage size={18} />
  if (contentType.startsWith("text/") || contentType.includes("pdf")) return <FileText size={18} />
  return <FileIcon size={18} />
}

export function Uploader({ clientId, files, readOnly = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<Progress[]>([])
  const [deleting, startDeleteTransition] = useTransition()

  const handleFiles = async (fileList: FileList) => {
    const list = Array.from(fileList)
    for (const f of list) {
      const id = crypto.randomUUID()
      setUploads((prev) => [...prev, { id, name: f.name, loaded: 0, total: f.size }])

      try {
        const blob = await upload(f.name, f, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ clientId }),
          onUploadProgress: ({ loaded, total }) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === id ? { ...u, loaded, total } : u)),
            )
          },
        })

        await registerFileAction({
          clientId,
          name: f.name,
          pathname: blob.pathname,
          url: blob.url,
          contentType: f.type || undefined,
          size: f.size,
        })

        setUploads((prev) => prev.filter((u) => u.id !== id))
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue"
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, error: msg } : u)),
        )
      }
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (readOnly) return
    if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
  }

  const onDelete = (fileId: string) => {
    if (!confirm("Supprimer ce fichier ?")) return
    startDeleteTransition(async () => {
      try {
        await deleteFileAction(fileId)
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/40"
            }`}
          >
            <UploadCloud size={32} className="text-muted-foreground" />
            <p className="text-sm font-medium">
              Glissez vos fichiers ici ou cliquez pour en choisir
            </p>
            <p className="text-xs text-muted-foreground">
              Vidéos broll, briefs, images… jusqu&apos;à 2&nbsp;Go par fichier
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void handleFiles(e.target.files)
                  e.target.value = ""
                }
              }}
            />
          </div>

          {uploads.length > 0 && (
            <ul className="space-y-2">
              {uploads.map((u) => {
                const pct = u.total > 0 ? Math.round((u.loaded / u.total) * 100) : 0
                return (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
                  >
                    {u.error ? (
                      <X size={16} className="text-destructive" />
                    ) : (
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{u.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.error ? "Échec" : `${pct}%`}
                        </span>
                      </div>
                      {!u.error && (
                        <div className="h-1 overflow-hidden rounded bg-secondary">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {u.error && (
                        <p className="text-xs text-destructive">{u.error}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {files.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun fichier pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              <span className="text-muted-foreground">
                <IconForFile contentType={f.contentType} />
              </span>
              <div className="flex-1 space-y-0.5">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {f.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {formatSize(f.size)} ·{" "}
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(f.createdAt)}
                </p>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(f.id)}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                  aria-label={`Supprimer ${f.name}`}
                >
                  {deleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </Button>
              )}
              {readOnly && (
                <CheckCircle2 size={14} className="text-emerald-500" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
