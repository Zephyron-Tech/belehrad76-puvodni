/**
 * Připraví fotky pro web z roztříděných originálů ve složce foto/:
 *
 *   foto/box/1-otevreny.jpg, 2-trinact-lahvi.jpg, 3-zavreny.jpg
 *   foto/hraci/NN-<slug>/1-lahev.jpg, 2-etiketa.jpg      (NN = číslo dresu, slug = Product.slug)
 *
 * Výstup do public/img/ (cesty používá DB – Product.imageUrl a galleryUrls):
 *   - .webp pro web (menší soubory, podporují všechny současné prohlížeče),
 *   - .jpg pro náhled při sdílení (Facebook, Messenger WebP spolehlivě nezobrazí).
 *
 *   public/img/box/otevreny.(webp|jpg), trinact-lahvi.*, zavreny.*
 *   public/img/hraci/<slug>-lahev.*, <slug>-etiketa.*
 *
 * Spuštění: npm run images:prepare
 */
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { PLAYERS } from "../prisma/players";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "foto");
const OUT = path.join(ROOT, "public", "img");

/** Nejdelší strana výstupu – originály jsou menší, takže se jen nezvětšují. */
const MAX_SIDE = 1600;

async function convert(src: string, outBase: string) {
  const image = sharp(src).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true });
  await image.clone().webp({ quality: 82, effort: 6 }).toFile(`${outBase}.webp`);
  await image.clone().jpeg({ quality: 85, mozjpeg: true }).toFile(`${outBase}.jpg`);
  const meta = await sharp(`${outBase}.webp`).metadata();
  const [webp, jpg] = await Promise.all([fs.stat(`${outBase}.webp`), fs.stat(`${outBase}.jpg`)]);
  console.log(
    `${path.relative(OUT, outBase).replace(/\\/g, "/")}  ${meta.width}×${meta.height}  webp ${Math.round(webp.size / 1024)} kB, jpg ${Math.round(jpg.size / 1024)} kB`,
  );
}

async function main() {
  await fs.mkdir(path.join(OUT, "box"), { recursive: true });
  await fs.mkdir(path.join(OUT, "hraci"), { recursive: true });

  // Box: otevřený, 13 lahví vedle sebe, zavřený (pořadí v galerii)
  await convert(path.join(SRC, "box", "1-otevreny.jpg"), path.join(OUT, "box", "otevreny"));
  await convert(path.join(SRC, "box", "2-trinact-lahvi.jpg"), path.join(OUT, "box", "trinact-lahvi"));
  await convert(path.join(SRC, "box", "3-zavreny.jpg"), path.join(OUT, "box", "zavreny"));

  // Hráči: nejdřív lahev, pak etiketa
  const dirs = await fs.readdir(path.join(SRC, "hraci"));
  for (const player of PLAYERS) {
    const dir = dirs.find((d) => d.endsWith(`-${player.slug}`));
    if (!dir) throw new Error(`Chybí fotky hráče ${player.slug} ve foto/hraci/`);
    await convert(path.join(SRC, "hraci", dir, "1-lahev.jpg"), path.join(OUT, "hraci", `${player.slug}-lahev`));
    await convert(path.join(SRC, "hraci", dir, "2-etiketa.jpg"), path.join(OUT, "hraci", `${player.slug}-etiketa`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
