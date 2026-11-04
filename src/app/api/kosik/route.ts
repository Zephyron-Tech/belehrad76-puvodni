import { NextResponse } from "next/server";
import { z } from "zod";
import { priceCartFromDb } from "@/lib/catalog";
import { readJson } from "@/lib/request";

const bodySchema = z.object({
  lines: z.array(z.object({ slug: z.string().max(100), quantity: z.number().int().min(0).max(1000) })).max(50),
});

/** Ocenění košíku podle aktuálních cen a skladu (jediný zdroj pravdy pro ceny a dopravu). */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await readJson(req, 16_384));
  if (!parsed.success) return NextResponse.json({ error: "Neplatný košík." }, { status: 400 });

  const { cart, settings } = await priceCartFromDb(parsed.data.lines);
  return NextResponse.json({
    ...cart,
    salesOpen: settings.bool("sales.open"),
    pickupEnabled: settings.bool("pickup.enabled"),
    leadTime: settings.text("bottle.lead_time"),
    boxDelivery: settings.text("box.delivery"),
  });
}
