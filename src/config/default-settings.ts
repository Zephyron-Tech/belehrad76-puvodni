/**
 * Výchozí konfigurace webu. Slouží k naplnění tabulky Setting (seed) a jako záloha,
 * když klíč v databázi chybí. Skutečné hodnoty se upravují v databázi.
 */
export const DEFAULT_SETTINGS: { key: string; value: string; description: string }[] = [
  // Prodávající
  { key: "seller.name", value: "Petite Eiffel, s.r.o.", description: "Obchodní firma prodávajícího" },
  { key: "seller.ico", value: "10788433", description: "IČO prodávajícího" },
  { key: "seller.dic", value: "CZ10788433", description: "DIČ prodávajícího" },
  { key: "seller.address", value: "U Tiskárny 616/9, Přívoz, 702 00 Ostrava", description: "Sídlo prodávajícího" },
  {
    key: "seller.register",
    value: "zapsaná v obchodním rejstříku vedeném Krajským soudem v Ostravě, oddíl C, vložka 85584",
    description: "Zápis v obchodním rejstříku",
  },

  // Kontakty
  { key: "contact.email", value: "info@belehrad76.cz", description: "Kontaktní e-mail na webu (DOPLNIT skutečný)" },
  {
    key: "mail.reply_to",
    value: "jan.kukula@petiteeiffel.cz, petr.safarcik@pam-group.cz",
    description: "Kam jdou odpovědi zákazníků na e-maily z e-shopu (víc adres oddělit čárkou; prázdné = contact.email)",
  },
  { key: "contact.phone", value: "", description: "Kontaktní telefon na webu (prázdné = nezobrazovat)" },
  {
    key: "owner.notify_email",
    value: "objednavky@belehrad76.cz",
    description: "Kam posílat upozornění na zaplacené objednávky (DOPLNIT skutečný)",
  },
  { key: "social.facebook_url", value: "", description: "Odkaz na Facebook (prázdné = nezobrazovat)" },
  { key: "social.instagram_url", value: "", description: "Odkaz na Instagram (prázdné = nezobrazovat)" },
  { key: "foundation.url", value: "", description: "Odkaz na web Nadace fotbalových internacionálů" },
  { key: "facr.url", value: "https://facr.fotbal.cz", description: "Odkaz na web FAČR" },

  // Prodej a doprava
  { key: "sales.open", value: "true", description: "true = prodej spuštěn, false = košík a objednávky vypnuty" },
  { key: "shipping.box_czk", value: "490", description: "Doprava za objednávku s boxem v Kč (jednou, i při více boxech a kusovkách)" },
  { key: "shipping.bottle_czk", value: "100", description: "Doprava za každou kusovku v Kč (jen u objednávky bez boxu)" },
  { key: "pickup.enabled", value: "true", description: "Osobní převzetí na FAČR (true/false)" },
  {
    key: "pickup.address",
    value: "Fotbalová asociace České republiky, Diskařská 2431/4, 160 17 Praha 6",
    description: "Adresa osobního převzetí (OVĚŘIT)",
  },
  {
    key: "pickup.note",
    value: "Termín převzetí s vámi domluvíme e-mailem nebo telefonicky. Při převzetí ověřujeme věk 18+.",
    description: "Poznámka k osobnímu převzetí",
  },
  {
    key: "bottle.lead_time",
    value: "Jednotlivé lahve připravujeme až na objednávku, dodací lhůta je 8 dní.",
    description: "Text o dodací lhůtě kusovek",
  },
  {
    key: "box.delivery",
    value: "Box doručujeme kurýrem, dodací lhůta je 8 dní.",
    description: "Text o doručení boxu (kurýr, dodací lhůta)",
  },
  { key: "order.max_boxes", value: "10", description: "Max. počet boxů v jedné objednávce" },
  { key: "order.max_bottles", value: "50", description: "Max. počet kusovek v jedné objednávce" },
  { key: "reservation.gopay_minutes", value: "30", description: "Jak dlouho se drží box při platbě přes GoPay (minuty)" },
  {
    key: "reservation.transfer_days",
    value: "7",
    description: "Jak dlouho se drží box při platbě převodem (dny). Pak se nezaplacená objednávka zruší.",
  },
  { key: "bank.account", value: "303642799/0300", description: "Číslo účtu pro platbu převodem (formát číslo/kód banky)" },

  // Texty úvodní stránky
  { key: "home.hero_kicker", value: "Limitovaná edice · 50 let od vítězství", description: "Nadtitulek na úvodu" },
  { key: "home.hero_title", value: "Mistři Evropy", description: "Hlavní nadpis" },
  { key: "home.hero_subtitle", value: "Bělehrad 1976", description: "Podnadpis" },
  {
    key: "home.hero_lead",
    value:
      "Speciální slivovice 50 % na počest mistrů Evropy z Bělehradu. Jen 152 sběratelských boxů, v každém 13 lahví – jedna za každého hráče. Celkem 1 976 lahví – jako rok, kdy Československo slavilo titul mistrů Evropy.",
    description: "Úvodní odstavec",
  },
  { key: "evening.date", value: "30. 11. 2026", description: "Datum slavnostního večera" },
  { key: "seo.description", value: "Limitovaná edice slivovice Mistři Evropy – Bělehrad 1976. 152 sběratelských boxů, 13 hráčů, 1 976 lahví. Výtěžek edice jde na podporu Nadace fotbalových internacionálů.", description: "Popis webu pro vyhledávače a sdílení" },
];
