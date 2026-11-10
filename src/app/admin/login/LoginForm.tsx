"use client";

import Script from "next/script";
import { useActionState } from "react";
import { loginAction } from "../actions";

const inputCls = "mt-1 w-full border border-line bg-ink px-3 py-2 text-cream focus:border-gold focus:outline-none";

export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      {state?.error && (
        <p role="alert" className="border border-danger/60 bg-danger/10 p-3 text-sm">
          {state.error}
        </p>
      )}
      <label className="block text-sm">
        E-mail
        <input name="email" type="email" autoComplete="username" required className={inputCls} />
      </label>
      <label className="block text-sm">
        Heslo
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      <label className="block text-sm">
        Ověřovací kód (2FA)
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{4,8}"
          required
          placeholder="123456"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">6místný kód z aplikace (Google Authenticator, Microsoft Authenticator…)</span>
      </label>
      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-language="cs" />
        </>
      )}
      <button type="submit" disabled={pending} className="w-full bg-gold px-4 py-2.5 font-bold text-ink hover:bg-gold-light disabled:opacity-60">
        {pending ? "Přihlašuji…" : "Přihlásit"}
      </button>
    </form>
  );
}
