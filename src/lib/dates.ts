// src/lib/dates.ts
// Türkiye saatine göre tarih işlemleri. Veritabanı UTC tutar, ekran Türkiye saatini gösterir.
// Türkiye 2016'dan beri sabit UTC+3 kullanıyor (yaz saati yok).
export const TZ = "Europe/Istanbul";

// Bir anın Türkiye saatine göre takvim tarihi, YYYY-MM-DD
export const dateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

// Maç günü Türkiye saatiyle 06:00'da başlar: gece oynanan Amerika maçları önceki güne sayılır.
const DAY_START_HOURS = 6;
const shiftBack = (d: Date) => new Date(d.getTime() - DAY_START_HOURS * 60 * 60 * 1000);

// Bugünün maç günü (sabah 06:00'dan önce bakılıyorsa hâlâ dünün maç günü)
export const todayTR = () => dateKey(shiftBack(new Date()));

// Bir maçın ait olduğu maç günü
export const matchDayKey = (d: Date) => dateKey(shiftBack(d));

// URL'deki ?date= parametresini doğrular, geçersizse bugünü döndürür
export const parseDateParam = (param?: string) => (param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : todayTR());

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Maç gününün başı ve sonu (UTC olarak): o gün 06:00 → ertesi gün 06:00, Türkiye saati
export const dayRange = (date: string) => ({
  start: new Date(`${date}T06:00:00+03:00`),
  end: new Date(`${shiftDate(date, 1)}T06:00:00+03:00`),
});

export const formatTime = (d: Date) => d.toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const formatLongDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });