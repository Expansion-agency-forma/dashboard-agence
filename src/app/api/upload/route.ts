import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/db/client"
import { clients } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getRole } from "@/lib/auth"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Only authenticated users can upload
        const { userId } = await auth()
        if (!userId) throw new Error("Unauthorized")

        const role = await getRole()
        const payload = clientPayload
          ? (JSON.parse(clientPayload) as { clientId?: string })
          : {}

        if (!payload.clientId) throw new Error("clientId manquant")

        // Authorization: agency can upload to any client; client can only upload to their own row
        if (role !== "agency") {
          const user = await currentUser()
          const email = user?.emailAddresses[0]?.emailAddress.toLowerCase()
          if (!email) throw new Error("Unauthorized")
          const [row] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, payload.clientId))
          if (!row || row.email !== email) {
            throw new Error("Accès interdit à ce client")
          }
        }

        return {
          allowedContentTypes: [
            "image/*",
            "video/*",
            "application/pdf",
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream",
            "text/*",
          ],
          // Limit 2GB — Vercel Blob max; adjust down later if needed
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId,
            clientId: payload.clientId,
            stepId: payload.clientId ? null : null,
          }),
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // We register the row in the DB via a server action from the client
        // after the upload is finalized. Nothing to do here.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
