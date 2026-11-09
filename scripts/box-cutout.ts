/**
 * Výřez boxu z fotky na bílém pozadí → PNG / WebP s průhledným pozadím (obrys boxu, bez bílého lemu).
 *
 * 1. Pozadí = světlé pixely dosažitelné od okraje fotky (bílá i šedý stín) → plně průhledné.
 * 2. Hrana boxu (pás pár pixelů na obě strany): z pixelu se odečte podíl bílé – zbytek je barva boxu
 *    a podíl bílé určí průhlednost. Hrana je tak vyhlazená, ale bez bílého lemu.
 * 3. Ořez na obrys boxu.
 *
 * Používá npm run images:prepare.
 */
import sharp from "sharp";

const WHITE_BG = 200; // jas bílého pozadí
const SHADOW = 90; // jas stínu (šedé pozadí kolem boxu)
const BOX_LUM = 35; // typický jas boxu (pro rozklad hranových pixelů)
const RIM = 3; // šířka pásu u hrany

export async function boxCutout(src: string): Promise<Buffer> {
  const { data, info } = await sharp(src).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const N = W * H;
  const lum = (i: number) => 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];

  // 1: pozadí od okrajů
  const bg = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (!bg[i] && lum(i) > SHADOW) {
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

  const lums: number[] = [];
  for (let i = 0; i < N; i += 7) if (bg[i]) lums.push(lum(i));
  lums.sort((a, b) => a - b);
  const white = lums[Math.floor(lums.length * 0.95)] || 255;

  // 2: pás u hrany – RIM px do boxu a RIM px do šedého pozadí
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
          if (!fromBg && lum(j) > WHITE_BG) continue; // bílé pozadí u hrany je celé průhledné
          band[j] = 1;
          next.push(j);
        }
      }
      frontier = next;
    }
  };
  grow(true);
  grow(false);

  const out = Buffer.alloc(N * 4);
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < N; i++) {
    let alpha = 1;
    const rgb = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    if (band[i]) {
      // pixel = a·bílá + (1−a)·box → průhlednost a, barva boxu bez bílé
      const a = Math.min(1, Math.max(0, (lum(i) - BOX_LUM) / (white - BOX_LUM)));
      alpha = 1 - a;
      for (let c = 0; c < 3; c++) rgb[c] = alpha > 0.02 ? Math.min(255, Math.max(0, (rgb[c] - a * white) / alpha)) : 0;
      if (alpha < 0.08) alpha = 0;
    } else if (bg[i]) alpha = 0;
    out[i * 4] = Math.round(rgb[0]);
    out[i * 4 + 1] = Math.round(rgb[1]);
    out[i * 4 + 2] = Math.round(rgb[2]);
    out[i * 4 + 3] = Math.round(alpha * 255);
    if (alpha > 0) {
      const x = i % W;
      const y = (i - x) / W;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // 3: ořez na obrys
  return sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}
