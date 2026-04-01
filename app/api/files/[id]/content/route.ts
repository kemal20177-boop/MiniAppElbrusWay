import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getFileBufferForUser } from "@/lib/files";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCurrentUser(request);
  const { file, buffer } = await getFileBufferForUser(user.id, params.id);
  const preview = request.nextUrl.searchParams.get("preview") === "1";
  const download = request.nextUrl.searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";
  const contentType =
    preview && file.mimeType.startsWith("text/")
      ? "text/plain; charset=utf-8"
      : file.mimeType;

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(file.originalName)}"`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60"
    }
  });
}
