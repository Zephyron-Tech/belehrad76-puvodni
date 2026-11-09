import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "../env";

export type OutgoingMail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Mail.Attachment[];
  replyTo?: string;
  /** Kopie (víc adres oddělených čárkou) */
  cc?: string;
};

/** Poslední odeslané e-maily (pro testy a ladění). */
export const sentMailLog: { to: string; cc?: string; subject: string; attachments: string[] }[] = [];

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const smtp = env.smtp;
  transporter = smtp.host
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      })
    : // Bez SMTP: e-mail se sestaví a uloží jako .eml do složky .mail-outbox
      nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  return transporter;
}

export async function sendMail(mail: OutgoingMail) {
  const info = await getTransporter().sendMail({
    from: env.mailFrom,
    to: mail.to,
    cc: mail.cc || undefined,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  });

  sentMailLog.push({
    to: mail.to,
    cc: mail.cc || undefined,
    subject: mail.subject,
    attachments: (mail.attachments ?? []).map((a) => String(a.filename ?? "")),
  });
  if (sentMailLog.length > 200) sentMailLog.shift();

  // Na Vercelu nelze zapisovat na disk – bez SMTP jen zalogovat
  if (!env.smtp.host && process.env.VERCEL) {
    console.log(`[mail] (bez SMTP, neodesláno) ${mail.subject} → ${mail.to}`);
    return;
  }

  if (!env.smtp.host && "message" in info && Buffer.isBuffer(info.message)) {
    const dir = path.resolve(env.mailOutboxDir);
    await fs.mkdir(dir, { recursive: true });
    const safe = mail.subject.normalize("NFD").replace(/[^\w-]+/g, "_").slice(0, 60);
    const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}_${safe}.eml`);
    await fs.writeFile(file, info.message);
    if (process.env.NODE_ENV !== "test") console.log(`[mail] ${mail.subject} → ${mail.to} (uloženo: ${file})`);
  }
}
