import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        _count: {
          select: {
            chats: true,
            files: true,
            documents: true,
            canvasDocs: true,
            searchSessions: true
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 200
    });

    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}
