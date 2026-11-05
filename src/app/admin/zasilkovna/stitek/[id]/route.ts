import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { labelsPdf } from "@/lib/packeta";
import { AppError } from "@/lib/errors";

/** Štítky zásilek Zásilkovny k objednávce (PDF z API Zásilkovny). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new NextResponse("Unauthorized", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new NextResponse("Not found", { status: 404 });

  const order = await prisma.order.findUnique({ where: { id }, select: { number: true, packetaPacketIds: true } });
  if (!order || order.packetaPacketIds.length === 0) return new NextResponse("Zásilka zatím nebyla založena.", { status: 404 });

  try {
    const settings = await getSettings();
    const pdf = await labelsPdf(order.packetaPacketIds, settings.str("packeta.label_format") || "A6 on A4");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="stitek-${order.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[admin] packeta label failed", err);
    const message = err instanceof AppError ? err.message : "Štítek se nepodařilo stáhnout.";
    return new NextResponse(message, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
