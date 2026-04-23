import { db } from "@/db/client"
import {
  clientAccess,
  clientFiles,
  clientFormationIntake,
  clientIntake,
  clients,
} from "@/db/schema"
import { and, desc, eq, isNotNull } from "drizzle-orm"

export type Notification = {
  id: string
  kind:
    | "pub_intake"
    | "formation_intake"
    | "file_upload"
    | "access_updated"
    | "card_confirmed"
    | "invite_sent"
  title: string
  clientId: string
  clientName: string
  createdAt: Date
  href: string
  meta?: string
}

/**
 * Aggregate recent client-driven events to display on the admin dashboard.
 * Derived from existing timestamps (no extra table yet).
 */
export async function getRecentNotifications(limit = 15): Promise<Notification[]> {
  const [pubIntakes, formationIntakes, recentFiles, recentAccess, cardConfirmations] = await Promise.all([
    db
      .select({
        clientId: clientIntake.clientId,
        clientName: clients.name,
        completedAt: clientIntake.completedAt,
      })
      .from(clientIntake)
      .innerJoin(clients, eq(clientIntake.clientId, clients.id))
      .where(isNotNull(clientIntake.completedAt))
      .orderBy(desc(clientIntake.completedAt))
      .limit(limit),

    db
      .select({
        clientId: clientFormationIntake.clientId,
        clientName: clients.name,
        completedAt: clientFormationIntake.completedAt,
        livretName: clientFormationIntake.livretName,
      })
      .from(clientFormationIntake)
      .innerJoin(clients, eq(clientFormationIntake.clientId, clients.id))
      .where(isNotNull(clientFormationIntake.completedAt))
      .orderBy(desc(clientFormationIntake.completedAt))
      .limit(limit),

    db
      .select({
        fileId: clientFiles.id,
        fileName: clientFiles.name,
        fileUploadedBy: clientFiles.uploadedBy,
        createdAt: clientFiles.createdAt,
        clientId: clients.id,
        clientName: clients.name,
        clientClerkUserId: clients.clerkUserId,
      })
      .from(clientFiles)
      .innerJoin(clients, eq(clientFiles.clientId, clients.id))
      .orderBy(desc(clientFiles.createdAt))
      .limit(limit * 2),

    db
      .select({
        clientId: clientAccess.clientId,
        clientName: clients.name,
        updatedAt: clientAccess.updatedAt,
        updatedBy: clientAccess.updatedBy,
        clientClerkUserId: clients.clerkUserId,
      })
      .from(clientAccess)
      .innerJoin(clients, eq(clientAccess.clientId, clients.id))
      .orderBy(desc(clientAccess.updatedAt))
      .limit(limit),

    db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        confirmedAt: clients.adAccountCardConfirmedAt,
        adAccountName: clients.adAccountName,
      })
      .from(clients)
      .where(isNotNull(clients.adAccountCardConfirmedAt))
      .orderBy(desc(clients.adAccountCardConfirmedAt))
      .limit(limit),
  ])

  const inviteConfirmations = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      inviteConfirmedAt: clients.adAccountInviteConfirmedAt,
    })
    .from(clients)
    .where(isNotNull(clients.adAccountInviteConfirmedAt))
    .orderBy(desc(clients.adAccountInviteConfirmedAt))
    .limit(limit)

  const notifications: Notification[] = []

  for (const p of pubIntakes) {
    if (!p.completedAt) continue
    notifications.push({
      id: `pub-${p.clientId}`,
      kind: "pub_intake",
      title: `${p.clientName} a complété son brief publicitaire`,
      clientId: p.clientId,
      clientName: p.clientName,
      createdAt: p.completedAt,
      href: `/admin/clients/${p.clientId}`,
    })
  }

  for (const f of formationIntakes) {
    if (!f.completedAt) continue
    notifications.push({
      id: `formation-${f.clientId}`,
      kind: "formation_intake",
      title: `${f.clientName} a déposé son livret de formation`,
      clientId: f.clientId,
      clientName: f.clientName,
      createdAt: f.completedAt,
      href: `/admin/clients/${f.clientId}`,
      meta: f.livretName ?? undefined,
    })
  }

  // Only show files uploaded BY THE CLIENT (uploader = client's clerk id)
  for (const f of recentFiles) {
    if (!f.clientClerkUserId) continue
    if (f.fileUploadedBy !== f.clientClerkUserId) continue
    notifications.push({
      id: `file-${f.fileId}`,
      kind: "file_upload",
      title: `${f.clientName} a déposé un fichier`,
      clientId: f.clientId,
      clientName: f.clientName,
      createdAt: f.createdAt,
      href: `/admin/clients/${f.clientId}`,
      meta: f.fileName,
    })
  }

  for (const a of recentAccess) {
    if (!a.clientClerkUserId || !a.updatedBy) continue
    if (a.updatedBy !== a.clientClerkUserId) continue
    notifications.push({
      id: `access-${a.clientId}-${a.updatedAt.getTime()}`,
      kind: "access_updated",
      title: `${a.clientName} a mis à jour ses accès`,
      clientId: a.clientId,
      clientName: a.clientName,
      createdAt: a.updatedAt,
      href: `/admin/clients/${a.clientId}`,
    })
  }

  for (const iv of inviteConfirmations) {
    if (!iv.inviteConfirmedAt) continue
    notifications.push({
      id: `invite-${iv.clientId}-${iv.inviteConfirmedAt.getTime()}`,
      kind: "invite_sent",
      title: `${iv.clientName} a invité l'agence sur son compte publicitaire`,
      clientId: iv.clientId,
      clientName: iv.clientName,
      createdAt: iv.inviteConfirmedAt,
      href: `/admin/clients/${iv.clientId}`,
    })
  }

  for (const c of cardConfirmations) {
    if (!c.confirmedAt) continue
    notifications.push({
      id: `card-${c.clientId}-${c.confirmedAt.getTime()}`,
      kind: "card_confirmed",
      title: `${c.clientName} a confirmé l'ajout de sa carte`,
      clientId: c.clientId,
      clientName: c.clientName,
      createdAt: c.confirmedAt,
      href: `/admin/clients/${c.clientId}`,
      meta: c.adAccountName ?? undefined,
    })
  }

  return notifications
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date)
}
