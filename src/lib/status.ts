// src/lib/status.ts
// BSD durum değerlerini ekran etiketine çevirir
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
    case "canceled": // aynı durum iki yazımla geliyor
      return "İptal";
    case "unresolved":
      return "Sonuç yok";
    default:
      return status;
  }
}