/**
 * Přihlášení do administrace objednávek: e-mail + heslo + 2FA (TOTP).
 * Jeden společný účet. Session v DB, v cookie jen náhodný token (v DB se ukládá jeho hash).
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { env } from "./env";
import { audit } from "./audit";
import { rateLimit } from "./rate-limit";
import { adminPinFor2fa, pinMatches } from "./site-pin";

export const SESSION_COOKIE = "admin_session";
/** Odhlášení po nečinnosti */
export const IDLE_TIMEOUT_MS = 30 * 60_000;
/** Maximální délka přihlášení */
export const ABSOLUTE_TIMEOUT_MS = 12 * 3_600_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

authenticator.options = { window: 1 };

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function generateTotpSecret() {
  return authenticator.generateSecret();
}

export function totpUri(email: string, secret: string) {
  return authenticator.keyuri(email, "Mistři Evropy 1976 – admin", secret);
}

export function verifyTotp(code: string, secret: string) {
  return authenticator.check(code.replace(/\s/g, ""), secret);
}

// Hash pro porovnání při neexistujícím účtu (stejná doba odezvy)
let dummyHash: string | null = null;
async function getDummyHash() {
  dummyHash ??= await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12);
  return dummyHash;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(input: { email: string; password: string; code: string }, ip: string | null): Promise<LoginResult> {
  const limited = rateLimit(`login:${ip ?? "unknown"}`, 10, 15 * 60_000);
  if (!limited.ok) return { ok: false, error: `Příliš mnoho pokusů. Zkuste to znovu za ${Math.ceil(limited.retryAfterSec / 60)} min.` };

  const generic: LoginResult = { ok: false, error: "Neplatné přihlašovací údaje nebo ověřovací kód." };
  const user = await prisma.adminUser.findUnique({ where: { email: input.email.trim().toLowerCase() } });

  if (!user) {
    await bcrypt.compare(input.password, await getDummyHash());
    await audit({ action: "login_failed" }, { source: "admin", ip });
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await audit({ action: "login_locked" }, { source: "admin", ip });
    return { ok: false, error: "Účet je po opakovaných neúspěšných pokusech dočasně zablokován. Zkuste to za 15 minut." };
  }

  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  // Testovací nasazení (SITE_PIN): místo kódu z autentikátoru stačí PIN webu
  const testPin = adminPinFor2fa();
  const codeOk =
    passwordOk && (verifyTotp(input.code, user.totpSecret) || (testPin !== "" && pinMatches(input.code.trim(), testPin)));

  if (!passwordOk || !codeOk) {
    const failed = user.failedAttempts + 1;
    await prisma.adminUser.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED_ATTEMPTS
          ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
          : { failedAttempts: failed },
    });
    await audit({ action: "login_failed" }, { source: "admin", ip });
    return generic;
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + ABSOLUTE_TIMEOUT_MS) },
  });
  // úklid starých session
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "strict",
    path: "/admin",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  });
  await audit({ action: "login_ok" }, { source: "admin", ip });
  return { ok: true };
}

/** Vrátí přihlášeného admina, nebo null. Prodlužuje session při aktivitě. */
export async function getAdminSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.lastSeenAt.getTime() < now - IDLE_TIMEOUT_MS) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.lastSeenAt.getTime() < now - 60_000) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return { sessionId: session.id, email: session.user.email };
}

/** Pro stránky a akce administrace: bez přihlášení přesměruje na login. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { id: hashToken(token) } });
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: env.secureCookies, sameSite: "strict", path: "/admin", maxAge: 0 });
}
