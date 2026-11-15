// src/lib/team-colors.ts
// Takımın renkleri: logosundaki en baskın 2-3 renk (maç posterindeki hover animasyonunda fırıldak dilimleri).
// Logo BSD görsel adresinden bir kez indirilir (token yok, kotaya sayılmaz), sonuç süreç boyunca bellekte tutulur.
// Görsel yoksa ya da çözümlenemezse null. Sayfa bu işi beklemesin diye teamColorsSoon kısa süre bekler; yetişmezse null döner,
// indirme arkada sürer ve sonraki istekte renkler hazır olur.

const LOGO_URL = (teamId: number) => `https://sports.bzzoiro.com/img/team/${teamId}/?bg=transparent`;
const SIZE = 32; // bu boyuta küçültülmüş logonun pikselleri sayılır
const MIN_DISTANCE = 110; // iki renk "farklı" sayılsın diye RGB uzaklığı
const SECOND_SHARE = 0.06; // ikinci renk en az bu kadar yer kaplamalı
const THIRD_SHARE = 0.12;

const cache = new Map<number, Promise<string[] | null>>();

type Rgb = [number, number, number];
const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const luminance = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

// Opak pikseller kaba renk kovalarına ayrılır; en kalabalık kova ve ondan yeterince farklı sonraki kovalar seçilir
export function dominantColors(rgba: Uint8Array | Buffer): string[] | null {
  const buckets = new Map<number, { n: number; sum: Rgb }>();
  let opaque = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 160) continue;
    opaque++;
    const key = ((rgba[i] >> 5) << 6) | ((rgba[i + 1] >> 5) << 3) | (rgba[i + 2] >> 5);
    const b = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] };
    b.n++;
    b.sum[0] += rgba[i];
    b.sum[1] += rgba[i + 1];
    b.sum[2] += rgba[i + 2];
    buckets.set(key, b);
  }
  if (opaque < 20) return null;

  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => ({ share: b.n / opaque, rgb: b.sum.map((v) => v / b.n) as Rgb }));
  const picked: Rgb[] = [ranked[0].rgb];
  for (const c of ranked.slice(1)) {
    if (picked.length === 3) break;
    if (c.share < (picked.length === 1 ? SECOND_SHARE : THIRD_SHARE)) break;
    if (picked.every((p) => distance(p, c.rgb) >= MIN_DISTANCE)) picked.push(c.rgb);
  }
  // Tek renkli logo (ya da beyazı silinmiş bayrak): açık renge mürekkep, koyu renge beyaz eşlik eder
  if (picked.length === 1) picked.push(luminance(picked[0]) > 170 ? [26, 26, 26] : [255, 255, 255]);
  return picked.map(hex);
}

async function load(teamId: number): Promise<string[] | null> {
  try {
    const res = await fetch(LOGO_URL(teamId), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const { default: sharp } = await import("sharp");
    const { data } = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(SIZE, SIZE, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return dominantColors(data);
  } catch (e) {
    console.warn(`Takım renkleri okunamadı (${teamId}): ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

export function teamColors(teamId: number): Promise<string[] | null> {
  let p = cache.get(teamId);
  if (!p) {
    p = load(teamId);
    cache.set(teamId, p);
    // Geçici hata (ağ, zaman aşımı) kalıcı olmasın: sonuç yoksa bir sonraki istekte yeniden denenir
    void p.then((colors) => colors === null && cache.delete(teamId));
  }
  return p;
}

// En çok `waitMs` bekler: renkler hazırsa (ya da o sürede gelirse) döner, yoksa null
export function teamColorsSoon(teamId: number, waitMs = 400): Promise<string[] | null> {
  return Promise.race([teamColors(teamId), new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs))]);
}
