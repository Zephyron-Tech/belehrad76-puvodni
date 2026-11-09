/**
 * Fotky boxu na tmavém pozadí (stejné jako nová fotka lahve): bílé pozadí fotky se nahradí tmavým
 * šedým přechodem – uprostřed o něco světlejším, k okrajům tmavším. Box se neořezává ani nevyřezává.
 *
 * 1. Bílé pozadí = vše světlé, co je dosažitelné od okraje fotky → nahradí se tmavým pozadím.
 * 2. Stín kolem boxu (šedý) = navazuje na bílé pozadí → nahradí se tmavším pozadím.
 * 3. Hrana boxu (pás pár pixelů na obě strany hrany – přechodové pixely a šedé obrysové linky víka): odečte se
 *    z nich jen podíl bílé a nahradí podílem tmavého pozadí – linky zůstanou souvislé, bez světlého lemu.
 *
 * Používá npm run images:prepare.
 */
import sharp from "sharp";

const EDGE = [16, 16, 18]; // tmavé pozadí u okrajů (podle fotky lahve)
const CENTER = [40, 38, 44]; // světlejší střed
const WHITE_BG = 200; // jas bílého pozadí
const SHADOW = 90; // jas stínu pod boxem
const BOX_LUM = 35; // typický jas boxu (pro rozklad přechodových pixelů)
const RIM = 4; // šířka pásu u hrany boxu, kde se přechodové pixely rozkládají

export async function boxOnBackdrop(src: string): Promise<sharp.Sharp> {
  const { data, info } = await sharp(src).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const N = W * H;
  const lum = (i: number) => 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];

  // 1 + 2: pozadí (BFS od okrajů) – bílá kdekoli, šedý stín jen ve spodní polovině
  const bg = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (bg[i]) return;
    const l = lum(i);
    if (l > SHADOW) {
      bg[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W);
    if (i < N - W) push(i + W);
  }

  // Referenční bílá (95. percentil jasu pozadí) a její barva
  const lums: number[] = [];
  for (let i = 0; i < N; i += 7) if (bg[i]) lums.push(lum(i));
  lums.sort((a, b) => a - b);
  const white = lums[Math.floor(lums.length * 0.95)] || 255;
  const whiteRgb = [white, white, white];

  // 3: pás u hrany boxu – RIM px do boxu a RIM px do šedého pozadí (obrysové linky)
  const band = new Uint8Array(N);
  const grow = (fromBg: boolean) => {
    let frontier: number[] = [];
    for (let i = 0; i < N; i++) if (!!bg[i] === fromBg) frontier.push(i);
    for (let d = 0; d < RIM; d++) {
      const next: number[] = [];
      for (const i of frontier) {
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= N || band[j] || !!bg[j] === fromBg) continue;
          if (!fromBg && lum(j) > WHITE_BG) continue; // bílé pozadí u hrany se nahradí celé
          band[j] = 1;
          next.push(j);
        }
      }
      frontier = next;
    }
  };
  grow(true); // do boxu
  grow(false); // do šedého pozadí

  const out = Buffer.from(data);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  for (let y = 0; y < H; y++) {
    const dy = (y - H / 2) / (H / 2);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!bg[i] && !band[i]) continue;
      const inBand = band[i] === 1;
      const dx = (x - W / 2) / (W / 2);
      const k = smooth(Math.min(1, Math.hypot(dx, dy) / 1.2)); // 0 uprostřed, 1 v rozích
      const backdrop = [0, 1, 2].map((c) => CENTER[c] + (EDGE[c] - CENTER[c]) * k);
      if (!inBand) {
        const f = Math.min(1, lum(i) / white); // stín pod boxem → tmavší
        for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(backdrop[c] * f);
      } else {
        // pixel = a·bílá + (1−a)·box → nahradit bílou složku tmavým pozadím
        const a = Math.min(1, Math.max(0, (lum(i) - BOX_LUM) / (white - BOX_LUM)));
        for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.round(data[i * 3 + c] + a * (backdrop[c] - whiteRgb[c])));
      }
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } });
}
