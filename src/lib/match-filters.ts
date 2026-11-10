// src/lib/match-filters.ts
// Günlük listelerde gösterilmeyen maç durumları.
// BSD ertelenen maçı bazen yeni bir id ile tekrar ekliyor ve eski kaydı "postponed" olarak aynı tarihte bırakıyor
// (replaced_by boş geliyor). İkisi birden listelenmesin diye ertelenen / iptal edilen maçlar listelere girmez.
export const HIDDEN_STATUSES = ["postponed", "cancelled", "canceled"];

// Prisma where parçası: { ...listable, eventDate: ... }
export const listable = { status: { notIn: HIDDEN_STATUSES } };
