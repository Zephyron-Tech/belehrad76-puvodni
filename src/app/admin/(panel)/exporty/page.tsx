import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Exporty" };

export default async function ExportsPage() {
  // Ověření v každé stránce, ne jen v layoutu: layout a stránka se vykreslují souběžně,
  // takže přesměrování z layoutu nezabrání tomu, aby se data stránky dostala do odpovědi.
  await requireAdmin();
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-bold text-gold">Exporty</h1>
      <p className="mt-2 text-sm text-muted">
        Soubory CSV pro Excel (oddělovač středník). Obsahují osobní údaje – ukládejte je jen na zabezpečená místa a po použití
        smažte. Každý export se zapisuje do záznamu změn.
      </p>

      <section className="mt-8 border border-line bg-panel p-5">
        <h2 className="font-serif text-xl font-bold text-cream">Objednávky pro účetnictví</h2>
        <form action="/admin/export/objednavky" method="get" className="mt-4 flex flex-wrap items-end gap-4 text-sm">
          <label className="block">
            Od
            <input type="date" name="od" className="mt-1 block border border-line bg-ink px-3 py-2" />
          </label>
          <label className="block">
            Do
            <input type="date" name="do" className="mt-1 block border border-line bg-ink px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 pb-2">
            <input type="checkbox" name="zaplacene" value="1" defaultChecked className="accent-[var(--gold)]" />
            Jen zaplacené
          </label>
          <button className="bg-gold px-4 py-2 font-bold text-ink hover:bg-gold-light">Stáhnout CSV</button>
        </form>
      </section>

      <section className="mt-6 border border-line bg-panel p-5">
        <h2 className="font-serif text-xl font-bold text-cream">Zájemci o slavnostní večer</h2>
        <p className="mt-2 text-sm text-muted">
          Zaplacené objednávky se zaškrtnutým zájmem o losování o vstup, s počtem boxů (vstup pro 1 osobu na 1 zakoupený box). Podklad pro organizátora losování.
        </p>
        <form action="/admin/export/vecer" method="get" className="mt-4">
          <button className="bg-gold px-4 py-2 text-sm font-bold text-ink hover:bg-gold-light">Stáhnout CSV</button>
        </form>
      </section>
    </div>
  );
}
