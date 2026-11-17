// src/lib/engine/lineup-pick.ts
// Tahmini ilk 11 seçimi ve sahaya diziliş. Saf fonksiyonlar, veritabanı yok.

export interface Candidate<T> {
  player: T;
  position: string | null; // G, D, M, F
  starts: number[]; // ilk 11 başladığı maçların sırası (0 = en yeni maç)
  subs: number[]; // yedekten girdiği maçların sırası
  rank?: number; // maç verisi yoksa hazır sıra (0 = en önde)
}

const DECAY = 0.85; // eski maç daha az sayılır
const SUB_WEIGHT = 0.3;

// Yakın zamanda ne kadar düzenli ilk 11 başladığı
export function lineupScore(c: Pick<Candidate<unknown>, "starts" | "subs" | "rank">): number {
  if (c.rank !== undefined) return 1 / (1 + c.rank);
  const w = (i: number) => DECAY ** i;
  return c.starts.reduce((s, i) => s + w(i), 0) + SUB_WEIGHT * c.subs.reduce((s, i) => s + w(i), 0);
}

type Line = "D" | "M" | "F";
const DEFAULT_SHAPE: Record<Line, number> = { D: 4, M: 3, F: 3 };
const SHAPE_LIMITS: Record<Line, [number, number]> = { D: [3, 5], M: [2, 5], F: [1, 4] };

// En yeni maçta ilk 11 başlayanların dizilişi (4-3-3 gibi); 10 saha oyuncusu etmiyorsa ya da uçuksa varsayılan
function shapeOf<T>(candidates: Candidate<T>[]): Record<Line, number> {
  const latest = candidates.filter((c) => c.starts.includes(0));
  const count = (line: Line) => latest.filter((c) => c.position === line).length;
  const shape = { D: count("D"), M: count("M"), F: count("F") };
  const valid =
    shape.D + shape.M + shape.F === 10 &&
    (Object.keys(shape) as Line[]).every((l) => shape[l] >= SHAPE_LIMITS[l][0] && shape[l] <= SHAPE_LIMITS[l][1]);
  return valid ? shape : DEFAULT_SHAPE;
}

// 1 kaleci + dizilişe göre her hattın en düzenli oyuncuları; eksik hat kalan en iyilerle tamamlanır.
// 11 kişi (ve bir kaleci) çıkmıyorsa null.
export function pickEleven<T>(candidates: Candidate<T>[], benchSize: number): { starters: T[]; bench: T[] } | null {
  const sorted = [...candidates].sort((a, b) => lineupScore(b) - lineupScore(a));
  const keeper = sorted.find((c) => c.position === "G");
  if (!keeper) return null;

  const shape = shapeOf(sorted);
  const chosen = new Set<Candidate<T>>([keeper]);
  for (const line of ["D", "M", "F"] as const) {
    for (const c of sorted.filter((c) => c.position === line).slice(0, shape[line])) chosen.add(c);
  }
  for (const c of sorted) {
    if (chosen.size >= 11) break;
    if (c.position !== "G") chosen.add(c);
  }
  if (chosen.size < 11) return null;

  return {
    starters: sorted.filter((c) => chosen.has(c)).map((c) => c.player),
    bench: sorted.filter((c) => !chosen.has(c)).slice(0, benchSize).map((c) => c.player),
  };
}

// Hazır bir ilk 11'den (BSD tahmini) oynayamayacakları çıkarır; her birinin yerine aynı hattan, yoksa (kaleci hariç)
// herhangi bir hattan en düzenli uygun adayı koyar. Çıkan sayısı maxReplace'i aşarsa ya da yer doldurulamazsa null:
// bu durumda tahmin güvenilmez sayılır ve başka kaynağa geçilir.
export function repairEleven<T extends { id: number; position: string | null }>(
  starters: T[],
  ok: (p: T) => boolean,
  pool: Candidate<T>[],
  maxReplace: number,
): { starters: T[]; replaced: { out: T; in: T }[] } | null {
  const removed = starters.filter((p) => !ok(p));
  if (removed.length > maxReplace) return null;
  const used = new Set(starters.filter(ok).map((p) => p.id));
  const sorted = pool.filter((c) => ok(c.player)).sort((a, b) => lineupScore(b) - lineupScore(a));
  const result = [...starters];
  const replaced: { out: T; in: T }[] = [];
  for (const out of removed) {
    const free = (c: Candidate<T>) => !used.has(c.player.id);
    const pick =
      sorted.find((c) => free(c) && c.position === out.position) ??
      (out.position !== "G" ? sorted.find((c) => free(c) && c.position !== "G") : undefined);
    if (!pick) return null;
    used.add(pick.player.id);
    result[result.indexOf(out)] = pick.player;
    replaced.push({ out, in: pick.player });
  }
  return { starters: result, replaced };
}

// ---------- Sahaya diziliş ----------

// Hat içinde soldan sağa sıra (sahaya ev sahibi kalesinden bakarken)
const LATERAL: Record<string, number> = {
  LB: 0, LWB: 0, LM: 0, LW: 0,
  CB: 5, DM: 5, CDM: 5, CM: 5, AM: 5, CAM: 5, ST: 5, CF: 5, SS: 5, GK: 5,
  RB: 10, RWB: 10, RM: 10, RW: 10,
};
// Hat içinde derinlik: orta sahada ön libero geride, ofansif orta saha ileride
const DEPTH: Record<string, number> = { DM: -1, CDM: -1, AM: 1, CAM: 1, SS: -1 };

export interface PitchRows<T> {
  keeper: T[];
  defence: T[];
  midfield: T[];
  attack: T[];
}

// İlk 11'i hatlara böler ve her hattı soldan sağa sıralar. Mevkisi bilinmeyen orta sahaya konur.
export function pitchRows<T extends { position: string | null; specificPosition: string | null }>(starters: T[]): PitchRows<T> {
  const lateral = (p: T) => LATERAL[p.specificPosition ?? ""] ?? 5;
  const depth = (p: T) => DEPTH[p.specificPosition ?? ""] ?? 0;
  const line = (code: string) => starters.filter((p) => (p.position ?? "M") === code).sort((a, b) => lateral(a) - lateral(b) || depth(a) - depth(b));
  const rows = { keeper: line("G"), defence: line("D"), midfield: line("M"), attack: line("F") };
  // Dengesiz hatlar (kadro listesinden tahminde olur): bir hat taşmasın, orta saha ve hücum boş kalmasın
  while (rows.attack.length > 4 || (rows.midfield.length === 0 && rows.attack.length > 2)) rows.midfield.push(rows.attack.pop()!);
  while (rows.defence.length > 5) rows.midfield.push(rows.defence.pop()!);
  while (rows.midfield.length > 5 || (rows.attack.length === 0 && rows.midfield.length > 2)) rows.attack.push(rows.midfield.pop()!);
  return rows;
}
