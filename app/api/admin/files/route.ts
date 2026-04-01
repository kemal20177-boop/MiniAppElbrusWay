import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const files = await prisma.userFile.findMany({
      where: {
        deletedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        _count: {
          select: {
            chunks: true,
            projectFiles: true,
            chatAttachments: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return NextResponse.json({ ok: true, files });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}
