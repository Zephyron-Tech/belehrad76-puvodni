import QRCode from "qrcode";
import { env } from "./env";

/**
 * Převod českého čísla účtu („předčíslí-číslo/kód banky“) na IBAN.
 * Např. 19-2000145399/0800 → CZ6508000000192000145399
 */
export function czechAccountToIban(account: string): string {
  const match = account.replace(/\s/g, "").match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!match) throw new Error(`Neplatné číslo účtu: ${account}`);
  const [, prefix = "", number, bank] = match;
  const bban = bank + prefix.padStart(6, "0") + number.padStart(10, "0");
  // CZ = 12 35, kontrolní číslice 00
  const check = 98 - mod97(`${bban}123500`);
  return `CZ${String(check).padStart(2, "0")}${bban}`;
}

function mod97(digits: string): number {
  let remainder = 0;
  for (const ch of digits) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder;
}

export function isValidIban(iban: string): boolean {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/** Text zprávy pro QR platbu: jen bezpečné znaky, bez diakritiky, max. 60 znaků. */
function spdText(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .toUpperCase();
}

/**
 * Řetězec pro českou QR platbu (Short Payment Descriptor, SPD 1.0).
 */
export function buildSpd(input: {
  iban: string;
  amountCzk: number;
  variableSymbol: string;
  message?: string;
  recipientName?: string;
}): string {
  const parts = [
    "SPD",
    "1.0",
    `ACC:${input.iban}`,
    `AM:${input.amountCzk.toFixed(2)}`,
    "CC:CZK",
    `X-VS:${input.variableSymbol.replace(/\D/g, "").slice(0, 10)}`,
  ];
  if (input.recipientName) parts.push(`RN:${spdText(input.recipientName, 35)}`);
  if (input.message) parts.push(`MSG:${spdText(input.message, 60)}`);
  return parts.join("*");
}

export type TransferInstructions = {
  account: string;
  iban: string;
  amountCzk: number;
  variableSymbol: string;
  spd: string;
};

/** Číslo účtu v databázi nesouhlasí s pojistkou – platební údaje ani QR kód se nevydají. */
export class BankAccountMismatchError extends Error {
  constructor(account: string) {
    super(`Číslo účtu pro platby (${account}) nesouhlasí s pojistkou BANK_ACCOUNT_LOCK – platební údaje zablokovány.`);
    this.name = "BankAccountMismatchError";
  }
}

/** Upozornění e-mailem při každém nesouhlasu čísla účtu – možné napadení databáze. */
function alertMismatch(account: string) {
  console.error(`[BEZPEČNOST] bank.account „${account}“ ≠ pojistka „${env.bankAccountLock}“ – platební údaje zablokovány`);
  // Dynamický import: bank.ts používají i e-mailové šablony, transport se načte až při upozornění
  import("./mail/transport")
    .then(({ sendMail }) =>
      sendMail({
        to: env.securityAlertEmail,
        subject: "BEZPEČNOST: číslo účtu pro platby nesouhlasí – platby převodem zablokovány",
        text: [
          `V nastavení e-shopu (bank.account) je účet: ${account}`,
          `Pojistka na serveru (BANK_ACCOUNT_LOCK) je: ${env.bankAccountLock}`,
          "",
          "E-shop proto nezobrazuje platební údaje ani QR kód a nepřijímá objednávky s platbou převodem.",
          "Pokud jste účet neměnili, mohlo dojít k napadení databáze – prověřte to.",
          "Pokud se účet mění záměrně, upravte i proměnnou BANK_ACCOUNT_LOCK na serveru a restartujte aplikaci.",
        ].join("\n"),
        html: `<p>V nastavení e-shopu (bank.account) je účet <b>${account.replace(/[<>&]/g, "")}</b>, pojistka na serveru je <b>${env.bankAccountLock}</b>.</p><p>Platby převodem jsou zablokované. Pokud jste účet neměnili, prověřte možné napadení databáze.</p>`,
      }),
    )
    .catch((e) => console.error("[BEZPEČNOST] upozornění se nepodařilo odeslat", e));
}

/** Ověří, že účet z databáze odpovídá pojistce (porovnává se IBAN). Jinak upozorní a vyhodí chybu. */
export function assertBankAccount(account: string) {
  let ok = false;
  try {
    ok = czechAccountToIban(account) === czechAccountToIban(env.bankAccountLock);
  } catch {
    ok = false;
  }
  if (!ok) {
    alertMismatch(account);
    throw new BankAccountMismatchError(account);
  }
}

export function transferInstructions(account: string, amountCzk: number, orderNumber: string, recipientName: string): TransferInstructions {
  assertBankAccount(account);
  const iban = czechAccountToIban(account);
  const spd = buildSpd({
    iban,
    amountCzk,
    variableSymbol: orderNumber,
    recipientName,
    message: `Objednavka ${orderNumber}`,
  });
  // Pojistka i pro obsah QR kódu: musí v něm být uzamčený účet
  if (!spd.includes(`ACC:${czechAccountToIban(env.bankAccountLock)}*`)) {
    alertMismatch(account);
    throw new BankAccountMismatchError(account);
  }
  return { account, iban, amountCzk, variableSymbol: orderNumber, spd };
}

export async function qrPng(spd: string): Promise<Buffer> {
  return QRCode.toBuffer(spd, { errorCorrectionLevel: "M", margin: 2, width: 360 });
}

export async function qrDataUrl(spd: string): Promise<string> {
  return QRCode.toDataURL(spd, { errorCorrectionLevel: "M", margin: 2, width: 360 });
}
