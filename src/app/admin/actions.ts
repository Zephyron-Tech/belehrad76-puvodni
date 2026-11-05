"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { login, logout, requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ADMIN_TRANSITIONS, changeStatus } from "@/lib/orders/transitions";
import { anonymizeOrder } from "@/lib/gdpr";
import { verifyTurnstile } from "@/lib/turnstile";
import { AppError, userMessage } from "@/lib/errors";
import { createPacketsForOrder } from "@/lib/packeta";

export type ActionState = { error?: string; ok?: string } | undefined;

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!(await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip))) {
    return { error: "Ověření, že nejste robot, se nezdařilo." };
  }
  const result = await login(
    {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      code: String(form.get("code") ?? ""),
    },
    ip,
  );
  if (!result.ok) return { error: result.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

const STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"];

export async function changeStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const ip = await getClientIp();
  const orderId = Number(form.get("orderId"));
  const to = String(form.get("to")) as OrderStatus;
  const actor = String(form.get("actor") ?? "").trim() || null;
  if (!Number.isInteger(orderId) || !STATUSES.includes(to)) return { error: "Neplatný požadavek." };

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return { error: "Objednávka neexistuje." };
  if (!ADMIN_TRANSITIONS[order.status].includes(to)) return { error: "Tento přechod stavu není povolen." };

  try {
    await changeStatus(
      orderId,
      to,
      { source: "admin", actor, ip },
      { carrier: String(form.get("carrier") ?? ""), trackingNumber: String(form.get("trackingNumber") ?? "") },
    );
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    console.error("[admin] status change failed", err);
    return { error: "Změnu se nepodařilo uložit." };
  }
  revalidatePath(`/admin/objednavky/${orderId}`);
  return { ok: "Stav objednávky byl změněn." };
}

export async function saveNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const ip = await getClientIp();
  const orderId = Number(form.get("orderId"));
  const note = String(form.get("internalNote") ?? "").slice(0, 4000);
  const actor = String(form.get("actor") ?? "").trim() || null;
  if (!Number.isInteger(orderId)) return { error: "Neplatný požadavek." };
  await prisma.order.update({ where: { id: orderId }, data: { internalNote: note || null } });
  await audit({ action: "internal_note", orderId }, { source: "admin", actor, ip });
  revalidatePath(`/admin/objednavky/${orderId}`);
  return { ok: "Poznámka uložena." };
}

export async function anonymizeAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const ip = await getClientIp();
  const orderId = Number(form.get("orderId"));
  if (!Number.isInteger(orderId)) return { error: "Neplatný požadavek." };
  if (form.get("confirm") !== "on") return { error: "Potvrďte anonymizaci zaškrtnutím." };
  try {
    await anonymizeOrder(orderId, { source: "admin", actor: String(form.get("actor") ?? "").trim() || null, ip });
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[admin] anonymize failed", err);
    return { error: userMessage(err, "Anonymizaci se nepodařilo provést.") };
  }
  revalidatePath(`/admin/objednavky/${orderId}`);
  return { ok: "Osobní údaje byly anonymizovány." };
}

const num = (min: number, max: number, label: string) =>
  z.coerce.number({ invalid_type_error: `${label}: zadejte číslo.` }).min(min, `${label}: min. ${min}.`).max(max, `${label}: max. ${max}.`);

const packetFormSchema = z.object({
  name: z.string().trim().min(1, "Vyplňte jméno příjemce.").max(32, "Jméno: max. 32 znaků."),
  surname: z.string().trim().min(1, "Vyplňte příjmení příjemce.").max(32, "Příjmení: max. 32 znaků."),
  email: z.string().trim().email("Neplatný e-mail příjemce."),
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,20}$/, "Neplatný telefon příjemce."),
  note: z.string().trim().max(128, "Poznámka: max. 128 znaků."),
  adultContent: z.boolean(),
  parcels: z
    .array(
      z.object({
        weightKg: num(0.1, 15, "Hmotnost (kg)"),
        valueCzk: num(1, 20000, "Hodnota (Kč)"),
        length: num(10, 1200, "Délka (mm)").int("Rozměry zadejte v celých mm."),
        width: num(10, 1200, "Šířka (mm)").int("Rozměry zadejte v celých mm."),
        height: num(10, 1200, "Výška (mm)").int("Rozměry zadejte v celých mm."),
      }),
    )
    .min(1)
    .max(10),
});

export async function createPacketsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const ip = await getClientIp();
  const orderId = Number(form.get("orderId"));
  const actor = String(form.get("actor") ?? "").trim() || null;
  if (!Number.isInteger(orderId)) return { error: "Neplatný požadavek." };

  const count = Math.min(10, Math.max(0, Number(form.get("parcelCount")) || 0));
  const str = (k: string) => String(form.get(k) ?? "");
  const parsed = packetFormSchema.safeParse({
    name: str("name"),
    surname: str("surname"),
    email: str("email"),
    phone: str("phone"),
    note: str("note"),
    adultContent: form.get("adultContent") === "on",
    parcels: Array.from({ length: count }, (_, i) => ({
      weightKg: str(`p${i}_weight`).replace(",", "."),
      valueCzk: str(`p${i}_value`).replace(/\s/g, ""),
      length: str(`p${i}_length`),
      width: str(`p${i}_width`),
      height: str(`p${i}_height`),
    })),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Zkontrolujte údaje zásilky." };
  const d = parsed.data;

  try {
    const barcodes = await createPacketsForOrder(
      orderId,
      { source: "admin", actor, ip },
      {
        recipient: { name: d.name, surname: d.surname, email: d.email, phone: d.phone },
        adultContent: d.adultContent,
        note: d.note,
        parcels: d.parcels.map((p) => ({
          weightKg: Math.round(p.weightKg * 1000) / 1000,
          valueCzk: Math.round(p.valueCzk),
          size: { length: p.length, width: p.width, height: p.height },
        })),
      },
    );
    revalidatePath(`/admin/objednavky/${orderId}`);
    return { ok: `Zásilka založena v Zásilkovně: ${barcodes.join(", ")}` };
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[admin] packeta create failed", err);
    revalidatePath(`/admin/objednavky/${orderId}`);
    return { error: userMessage(err, "Zásilku se nepodařilo založit.") };
  }
}
