/**
 * Výchozí naplnění databáze: 14 produktů, konfigurace a texty.
 * Seed pouze DOPLŇUJE chybějící záznamy – nikdy nepřepíše hodnoty upravené v databázi.
 * Spuštění: npm run db:seed
 */
import { PrismaClient, ProductType } from "@prisma/client";
import { PLAYERS } from "./players";
import { DEFAULT_PAGES } from "./seed-pages";
import { DEFAULT_SETTINGS } from "../src/config/default-settings";

const prisma = new PrismaClient();


async function main() {
  // Produkty
  await prisma.product.upsert({
    where: { slug: "box-mistri-evropy" },
    update: {},
    create: {
      slug: "box-mistri-evropy",
      type: ProductType.BOX,
      name: "Box Mistři Evropy",
      shortDescription: "Všech 13 hráčů finále v jednom číslovaném boxu. V každé lahvi 0,35l 50% Slivovice. Limitovaná edice 152 boxů.",
      description: [
        "Sběratelský box limitované edice **Mistři Evropy – Bělehrad 1976**.",
        "",
        "Obsahuje 13 lahví speciální slivovice 50 %. Každá lahev nese portrét, jméno a číslo jednoho z mistrů Evropy.",
        "",
        "Celá edice čítá 152 boxů a 1 976 lahví. Výtěžek edice jde na podporu Nadace fotbalových internacionálů.",
      ].join("\n"),
      priceCzk: 9880,
      stock: 144,
      madeToOrder: false,
      imageUrl: "/img/box/otevreny.webp?v=2",
      galleryUrls: ["/img/box/otevreny.webp?v=2"],
      sortOrder: 0,
    },
  });

  for (const [index, p] of PLAYERS.entries()) {
    const fullName = `${p.firstName} ${p.lastName}`;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        type: ProductType.BOTTLE,
        name: `Slivovice ${fullName}`,
        playerName: fullName,
        playerNumber: p.number,
        shortDescription: `${fullName}, číslo ${p.number} – lahev slivovice 50 % s jeho portrétem na etiketě.`,
        description: [
          `Samostatná lahev z edice **Mistři Evropy – Bělehrad 1976**. Etiketu zdobí portrét, jméno a číslo dresu – **${fullName}, ${p.number}**.`,
          "",
          "Speciální slivovice 50 %. Skvělý dárek pro každého fanouška československého fotbalu.",
          "",
          "Výtěžek edice jde na podporu Nadace fotbalových internacionálů.",
        ].join("\n"),
        priceCzk: 760,
        stock: null,
        madeToOrder: true,
        imageUrl: `/img/hraci/${p.slug}-lahev.webp`,
        galleryUrls: [`/img/hraci/${p.slug}-lahev.webp`, `/img/hraci/${p.slug}-etiketa.webp`],
        sortOrder: index + 1,
      },
    });
  }

  // Konfigurace
  await prisma.setting.createMany({ data: DEFAULT_SETTINGS, skipDuplicates: true });

  // Texty
  await prisma.page.createMany({ data: DEFAULT_PAGES, skipDuplicates: true });

  const [products, settings, pages] = await Promise.all([
    prisma.product.count(),
    prisma.setting.count(),
    prisma.page.count(),
  ]);
  console.log(`Seed hotov: ${products} produktů, ${settings} nastavení, ${pages} textů.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
