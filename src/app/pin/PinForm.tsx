"use client";

import { useActionState } from "react";
import { submitPin } from "./actions";

export function PinForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(submitPin, undefined);
  return (
    <form action={action} className="mt-6 grid gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="pin" className="sr-only">
        PIN
      </label>
      <input
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        required
        placeholder="PIN"
        className="border border-line bg-ink px-4 py-3 text-center text-lg tracking-[0.4em] text-cream outline-none focus:border-gold"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-gold px-6 py-3 font-bold uppercase tracking-wider text-ink transition hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Ověřuji…" : "Vstoupit"}
      </button>
    </form>
  );
}
