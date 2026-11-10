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
