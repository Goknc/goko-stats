// src/lib/engine/player-bio.ts
// Oyuncu profili gösterim yardımcıları: yaş, para, sezon sırası, mevki ve transfer türü adları, kariyer toplamı.
// Saf fonksiyonlar, veritabanı yok.

export function ageOn(birth: Date, now: Date): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

// 32000000 → "32 mn €", 1500000 → "1,5 mn €", 850000 → "850 bin €"
export function formatEur(n: number | null): string | null {
  if (n === null || n <= 0) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toLocaleString("tr-TR", { maximumFractionDigits: m >= 10 ? 0 : 1 })} mn €`;
  }
  return `${Math.round(n / 1000).toLocaleString("tr-TR")} bin €`;
}

// Sezon adından sıralama anahtarı: "Premier League 25/26" → 2026, "MLS 2024" → 2024, "2023/2024" → 2024.
// Yıl bulunamazsa 0 (en sona).
export function seasonYear(name: string | null): number {
  if (!name) return 0;
  const full = [...name.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const split = name.match(/\b(\d{2})\/(\d{2})\b/);
  if (split) return 2000 + Number(split[2]);
  return full.length ? Math.max(...full) : 0;
}

const SPECIFIC_POSITIONS: Record<string, string> = {
  GK: "Kaleci",
  CB: "Stoper",
  LB: "Sol bek",
  RB: "Sağ bek",
  LWB: "Sol kanat bek",
  RWB: "Sağ kanat bek",
  DM: "Ön libero",
  CDM: "Ön libero",
  CM: "Merkez orta saha",
  AM: "Ofansif orta saha",
  CAM: "Ofansif orta saha",
  LM: "Sol orta saha",
  RM: "Sağ orta saha",
  LW: "Sol kanat",
  RW: "Sağ kanat",
  ST: "Santrfor",
  CF: "Santrfor",
  SS: "İkinci forvet",
};
export const specificPositionName = (code: string | null) => (code ? (SPECIFIC_POSITIONS[code] ?? code) : null);

const FEET: Record<string, string> = { R: "Sağ", L: "Sol", B: "İki ayak" };
export const footName = (code: string | null) => (code ? (FEET[code] ?? code) : null);

// Uygunluk: "available" dışındaki durumlar uyarı olarak gösterilir
export function availabilityLabel(a: string | null): string | null {
  if (!a || a === "available") return null;
  const map: Record<string, string> = { injured: "Sakat", doubtful: "Şüpheli", suspended: "Cezalı", unavailable: "Oynayamaz" };
  return map[a] ?? a;
}

// Sakatlık / ceza türü: bilinenler Türkçe, bilinmeyen İngilizce kalır, "Unknown" gösterilmez
const INJURY_WORDS: [RegExp, string][] = [
  [/yellow_card/i, "Sarı kart cezası"],
  [/red_card/i, "Kırmızı kart cezası"],
  [/suspension/i, "Ceza"],
  [/cruciate|acl/i, "Çapraz bağ sakatlığı"],
  [/menisc/i, "Menisküs sakatlığı"],
  [/hamstring/i, "Arka adale sakatlığı"],
  [/groin|adductor/i, "Kasık sakatlığı"],
  [/calf/i, "Baldır sakatlığı"],
  [/thigh|quadriceps/i, "Uyluk sakatlığı"],
  [/muscle/i, "Kas sakatlığı"],
  [/ankle/i, "Ayak bileği sakatlığı"],
  [/knee/i, "Diz sakatlığı"],
  [/achilles/i, "Aşil sakatlığı"],
  [/foot|toe/i, "Ayak sakatlığı"],
  [/back/i, "Sırt sakatlığı"],
  [/shoulder/i, "Omuz sakatlığı"],
  [/hip/i, "Kalça sakatlığı"],
  [/head|concussion/i, "Kafa travması"],
  [/fracture|broken/i, "Kırık"],
  [/illness|virus|flu/i, "Hastalık"],
  [/knock/i, "Darbe"],
];
export function injuryName(type: string | null): string | null {
  if (!type || /^unknown$/i.test(type)) return null;
  return INJURY_WORDS.find(([re]) => re.test(type))?.[1] ?? type;
}

// BSD transfer_type: 1 kiralık, 2 kiralıktan dönüş, 3 bonservisli
export function transferLabel(type: number | null, feeDescription: string | null): string {
  if (type === 1) return "Kiralık";
  if (type === 2) return "Kiralıktan dönüş";
  const fee = feeDescription && feeDescription !== "-" ? feeDescription : null;
  return fee ?? "Bonservis";
}

export interface CareerRowLike {
  teamId: number;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
}

export function careerTotals(rows: CareerRowLike[], exclude: (r: CareerRowLike) => boolean = () => false) {
  return rows
    .filter((r) => !exclude(r))
    .reduce((t, r) => ({ matches: t.matches + r.matches, minutes: t.minutes + r.minutes, goals: t.goals + r.goals, assists: t.assists + r.assists }), {
      matches: 0, minutes: 0, goals: 0, assists: 0,
    });
}

// Sezonun başladığı yıl: "Premier League 25/26" → 2025, "MLS 2024" → 2024. Bulunamazsa 0.
export function seasonStartYear(name: string | null): number {
  if (!name) return 0;
  const split = name.match(/\b(\d{2})\/(\d{2})\b/);
  if (split) return 2000 + Number(split[1]);
  return seasonYear(name);
}

// Transfer bedeli etiketi. BSD transfer_type: 1 kiralık, 2 kiralıktan dönüş, 3 bonservisli.
// kind: paid = bonservis ödendi, loan = kiralık / kiralıktan dönüş, free = bedelsiz ya da bedel bilinmiyor
export function transferFee(
  type: number | null,
  feeEur: number | null,
  feeDescription: string | null,
): { text: string; kind: "paid" | "loan" | "free" } {
  if (type === 1) return { text: feeEur && feeEur > 0 ? `Kiralık · ${formatEur(feeEur)}` : "Kiralık", kind: "loan" };
  if (type === 2) return { text: "Kiralıktan dönüş", kind: "loan" };
  const amount = formatEur(feeEur);
  if (amount) return { text: amount, kind: "paid" };
  if (feeDescription && /free/i.test(feeDescription)) return { text: "Bedelsiz", kind: "free" };
  return { text: "Bedel açıklanmadı", kind: "free" };
}

export interface CareerSeasonLike extends CareerRowLike {
  seasonName: string | null;
  teamName: string | null;
  avgRating: number | null;
}

// Bir takımda geçirilen dönem: o takımdaki bütün sezonların toplamı
export interface CareerStint<T extends CareerSeasonLike> {
  teamId: number;
  teamName: string;
  national: boolean;
  seasons: number; // farklı sezon (başlangıç yılı) sayısı
  fromYear: number;
  toYear: number;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  avgRating: number | null; // maç sayısıyla ağırlıklı
  rows: T[]; // en yeni sezondan eskiye
}

// Kariyer satırlarını (sezon × turnuva × takım) takım takım toplar. Sıra: en son oynadığı takım önce.
export function careerStints<T extends CareerSeasonLike>(rows: T[], nationalTeamId: number | null): CareerStint<T>[] {
  const byTeam = new Map<number, T[]>();
  for (const r of rows) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, []);
    byTeam.get(r.teamId)!.push(r);
  }
  const stints = [...byTeam.entries()].map(([teamId, list]): CareerStint<T> => {
    const sorted = [...list].sort((a, b) => seasonYear(b.seasonName) - seasonYear(a.seasonName));
    const starts = sorted.map((r) => seasonStartYear(r.seasonName)).filter((y) => y > 0);
    const ends = sorted.map((r) => seasonYear(r.seasonName)).filter((y) => y > 0);
    const rated = sorted.filter((r) => r.avgRating !== null && r.matches > 0);
    const ratedMatches = rated.reduce((n, r) => n + r.matches, 0);
    const total = careerTotals(sorted);
    return {
      teamId,
      teamName: sorted.find((r) => r.teamName)?.teamName ?? "–",
      national: teamId === nationalTeamId,
      seasons: new Set(starts).size || 1,
      fromYear: starts.length ? Math.min(...starts) : 0,
      toYear: ends.length ? Math.max(...ends) : 0,
      ...total,
      avgRating: ratedMatches ? rated.reduce((n, r) => n + r.avgRating! * r.matches, 0) / ratedMatches : null,
      rows: sorted,
    };
  });
  return stints.sort((a, b) => b.toYear - a.toYear || b.fromYear - a.fromYear || b.matches - a.matches);
}
