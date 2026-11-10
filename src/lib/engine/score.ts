// src/lib/engine/score.ts
// Sıralama puanı: örneğe 1 "tuttu" ve 1 "tutmadı" eklenmiş gibi hesaplanır.
// Küçük örneklerin şişkin oranlarını aşağı çeker, büyük örnekleri az etkiler.
// Yalnızca sıralamada kullanılır; ekranda ham oran gösterilir.
export function confidenceScore(hits: number, total: number): number {
  return (hits + 1) / (total + 2);
}