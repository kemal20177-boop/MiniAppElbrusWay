import { NextRequest, NextResponse } from "next/server";
import { createEmbeddings } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { embeddingsSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = embeddingsSchema.parse(body);
    const result = await createEmbeddings({
      user,
      model: payload.model,
      input: payload.input,
      encodingFormat: payload.encoding_format
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "EMBEDDINGS_REQUEST_FAILED",
        message: (error as Error).message
      },
      { status: 400 }
    );
  }
}
