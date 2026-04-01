import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getFileBufferForUser } from "@/lib/files";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCurrentUser(request);
  const { file, buffer } = await getFileBufferForUser(user.id, params.id);

  return new Response(buffer, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
