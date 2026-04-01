import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  displayName: z.string().min(2).max(120).optional(),
  isEnabled: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  featuredGroup: z.enum(["top_chat", "top_image", "top_audio", "fast", "cheap", "premium", "coding", "reasoning"]).nullable().optional(),
  featuredOrder: z.number().int().min(0).max(999).optional(),
  minPlan: z.enum(["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"]).optional(),
  markupFactor: z.number().min(0).max(100).optional(),
  inputPrice: z.number().min(0).optional(),
  outputPrice: z.number().min(0).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
  supportsImages: z.boolean().optional(),
  supportsFiles: z.boolean().optional(),
  supportsAudio: z.boolean().optional(),
  supportsVideo: z.boolean().optional(),
  supportsReasoning: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
  supportsWebSearch: z.boolean().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = schema.parse(body);
    const model = await prisma.modelConfig.update({
      where: { id: params.id },
      data: payload
    });
    return NextResponse.json({ ok: true, model });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_MODEL_UPDATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
