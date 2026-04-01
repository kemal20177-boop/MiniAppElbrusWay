import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const documents = await prisma.document.findMany({
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
        versions: {
          orderBy: { version: "desc" },
          take: 1
        },
        exports: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 200
    });

    return NextResponse.json({ ok: true, documents });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}
