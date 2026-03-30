import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "elbrusway-next-mvp",
    timestamp: new Date().toISOString()
  });
}
