# Gokostats

[English](README.md) · **Türkçe**

Bir futbol istatistik uygulaması. 90'dan fazla turnuvada (ligler, ulusal kupalar, kıta ve milli takım turnuvaları) takım ve oyuncu trendleri, form tabloları, aralarındaki maçlar, iki takımın yan yana karşılaştırması ve maç analizi sunar. Hepsi son maç verilerinden hesaplanır.

## Özellikler

- **Günlük maç listesi**: takip edilen ligler popülerlik sırasıyla, takvimli tarih seçici.
- **Maç detayı**: skor, maç ve yarı yarı istatistikler, öne çıkan trendler, skor tahmin modeli, aralarındaki maçlar (tümü / ev / deplasman, son 5/10/20/tümü), maç maç dökümlü takım trend kartları, sahaya dizilmiş kadrolar (kesin ya da tahmini ilk 11, yedekler ve takım liderlerini gösteren semboller) ve iki kadronun oyuncu kartları. Maç sayısı, form türü ve öne çıkma eşiği sayfadan değiştirilebilir.
- **Trendler**: günün maçlarında iki takımın da son maçlarında eşiği geçtiği istatistikler (ör. *son 20 maçın 14'ünde iki takım da gol attı*, *10+ korner*, *oyuncu 3+ şut*). Trende göre filtrelenir; yüzde, saat ya da maça göre sıralanır.
- **Takım sayfası**: son 5/10/20 maçta gol, korner, şut, kart ve faul. Saha, turnuva ve yarı filtresi var; liste ya da eşiği ayarlanabilir grafik olarak görülür. Kadro için oyuncu tablosu da içerir.
- **Oyuncu sayfası**: profil, süren seriler (*5 maçtır gol atıyor*), özet (toplam, maç başı, 90 dakikada, ortalama puan), maç maç sayı, rakip ve dakikayla öne çıkan özellikler, detaylı istatistikler (pas, kilit pas, ikili mücadele, hava topu, çalım, ofsayt, xG/xA, kurtarış…), istenen istatistik için maç maç grafik tam maç kaydı, takım takım kariyer özeti ve transfer geçmişi.
- **Arama**: başlıkta takım ve oyuncu için otomatik tamamlama (klavyeyle kullanılabilir) ve sonuç sayfası.
- **Karşılaştır**: seçilen iki takımın formu, maç başı ortalamaları, maç trendleri ve aralarındaki maçlar.
- **Krallık**: güncel sezonun ~30 kategoride liderleri (gol, asist, şut, xG, kilit pas, pas, ikili mücadele, hava topu, top kapma, pas arası, ofsayt, kart, kurtarış, puan…); toplama, maç başı ya da 90 dakika başı ortalamaya göre (en az maç şartıyla). Varsayılan tüm ligler birlikte, istenirse tek lig seçilir.
- Mobil, tablet ve masaüstü uyumlu arayüz. Milli takım ve uluslararası turnuva adları Türkçe gösterilir (veri kaynağındaki adlar değişmeden saklanır).

## Nasıl çalışır

- **Örnek kuralı:** takımın son iki sezonda aynı turnuva türündeki son N maçı (varsayılan 20); tüm maçlar ya da yalnızca iç/dış saha. Oyuncularda son N **ilk 11** maçı sayılır (kadro biliniyorsa kadrodan, bilinmiyorsa 60+ dakika).
- **Öne çıkan trend:** karar veren karne(ler)in oranı eşiği geçerse trend öne çıkar. Aynı istatistikte (10+ / 11+ / 12+ korner gibi) yalnızca eşiği geçen en yüksek basamak gösterilir. Tanımlar [`src/lib/trend-config.ts`](src/lib/trend-config.ts) dosyasında.
- **Kart sayımı:** sarı 1, kırmızı 2. İkinci sarıdan atılan oyuncu toplam 3 sayılır.
- **Skor tahmini:** yaklaşık 25 bin maçla eğitilmiş Poisson regresyonu (Elo farkı, rakibe göre düzeltilmiş goller, form, dinlenme, aralarındaki maçlar) ve Dixon–Coles düzeltmesi. Yeterli veri yoksa klasik Poisson modeline düşer.
- **Tahmini ilk 11:** veri kaynağı kadro vermediğinde takımın son maçlarında en düzenli ilk 11 başlayan oyunculardan, o da yoksa kadro listesinden oluşturulur.

> Gokostats kişisel bir projedir. İstatistikler geçmiş maçlara dayanır ve yalnızca bilgi amaçlıdır; hiçbir içerik bahis tavsiyesi değildir.

## Teknoloji

Next.js 16 (App Router, sunucu bileşenleri) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · Prisma 7 · PostgreSQL · Vitest · Playwright · GitHub Actions · Vercel

Veri kaynağı: [Bzzoiro Sports Data](https://sports.bzzoiro.com) API.

## Kurulum

Gerekenler: Node.js 20+, PostgreSQL, BSD API anahtarı.

```bash
npm install
cp .env.example .env          # DATABASE_URL ve BSD_API_TOKEN değerlerini doldur
npx prisma migrate deploy
npm run db:seed               # takip edilen ligler
npm run sync:daily            # sezonlar, maçlar, maç ve oyuncu istatistikleri, kadrolar
npm run dev                   # http://localhost:3000
```

| Komut | Ne yapar |
|---|---|
| `npm run sync:daily` | Sezonlar → maçlar → maç ve oyuncu istatistikleri → önümüzdeki 48 saatin kadroları |
| `npm run sync:lineups` | 3 saat içinde başlayacak maçların kadroları |
| `npm run sync:players` | Takip edilen kadroların oyuncu profilleri (yaş, boy, piyasa değeri, sözleşme, sakatlık) + 30 gündür güncellenmemiş en çok oynayan 800 oyuncunun kariyer ve transferleri; haftalık çalışır |
| `npm run sync:player-extras -- --limit 300 [--all] [--dry]` | Eski maçlar için detaylı oyuncu istatistiklerini bir kerelik doldurur (maç başına 1 istek) |

Canlı ortamda bu komutlar [`.github/workflows/sync.yml`](.github/workflows/sync.yml) ile zamanlanmış olarak çalışır.

## Yayına alma (Vercel + barındırılan Postgres)

1. Bir Postgres veritabanı aç (ör. Neon ya da Supabase ücretsiz katman). Tüm veri yaklaşık 100 MB.
2. Migration'ları uygula: `DATABASE_URL=... npx prisma migrate deploy`, ardından `npm run db:seed`.
3. Veriyi yükle: `npm run sync:daily` ile ya da yerel veritabanını kopyalayarak (`pg_dump --data-only` → `psql`).
4. Repoyu Vercel'e aktar ve `DATABASE_URL` değişkenini gir (pooled bağlantı adresi).
5. GitHub'da `DATABASE_URL` ve `BSD_API_TOKEN` repo secret'larını ekle; zamanlanmış senkron veriyi güncel tutar.

## Test

```bash
npm run lint
npx vitest run          # analiz motoru birim testleri
npm run test:e2e        # production build'e karşı Playwright (masaüstü + mobil)
```

## Uyarı

İstatistikler geçmiş maçlara dayanır ve yalnızca bilgi amaçlıdır. Veriler © Bzzoiro Sports Data. Takım logoları ve oyuncu fotoğrafları sahiplerine aittir.

## Lisans

[MIT](LICENSE)
