// Süreli bellek önbelleği: ağır hesapları (maç analizi) birkaç dakika saklar.
// Promise saklanır: aynı anda gelen istekler aynı hesabı bekler, iki kez hesaplanmaz.
// globalThis üzerinde durur ki geliştirme modunda dosya kaydedince (HMR) sıfırlanmasın.
type Entry = { at: number; value: Promise<unknown> };

const g = globalThis as unknown as { __statsCache?: Map<string, Entry> };
const store = (g.__statsCache ??= new Map<string, Entry>());
const MAX_ENTRIES = 3000;

export function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;

  // Hata olursa saklama: bir sonraki istek yeniden denesin
  const value = compute().catch((e) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { at: now, value });

  // Şişmesin: sınır aşılınca süresi geçenleri, yine de fazlaysa en eskileri at
  if (store.size > MAX_ENTRIES) {
    for (const [k, e] of store) if (now - e.at >= ttlMs) store.delete(k);
    for (const k of store.keys()) {
      if (store.size <= MAX_ENTRIES) break;
      store.delete(k);
    }
  }
  return value;
}

// Ayarlar değişince (eşikler) eski sonuçlar geçersiz olur
export function clearCache(prefix = "") {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
