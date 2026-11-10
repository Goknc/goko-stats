// src/lib/status.ts
// BSD durum değerlerini ekran etiketine çevirir (Spike B4, B7)
export function statusLabel(status: string): string {
  switch (status) {
    case "notstarted":
      return "";
    case "inprogress":
      return "Canlı";
    case "finished":
      return "Bitti";
    case "postponed":
      return "Ertelendi";
    case "cancelled":
    case "canceled": // B7: aynı durum iki yazımla geliyor
      return "İptal";
    case "unresolved":
      return "Sonuç yok";
    default:
      return status;
  }
}