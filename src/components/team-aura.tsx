// Maç posterinde takımın üstüne gelince logonun çevresinde beliren, takıma özel animasyon:
// takım renklerinde dönen bir fırıldak ve çevresinde yörüngede dönen simge sticker'ları
// (Galatasaray'a aslan, Fenerbahçe'ye kanarya, Norveç'e Viking baltası...).
// Listede olmayan takımda yalnızca fırıldak döner; renkleri logosundan çıkarılır (team-colors.ts). Logo okunamazsa ya da henüz inmediyse
// genel alev halkası (FlameRing) gösterilir. Yeni takım eklemek için AURAS'a bir satır yeter.
// Görünürlük ve animasyon globals.css > .team-aura; kapsayan öğede `group` sınıfı olmalı.
import type { CSSProperties } from "react";
import { FlameRing } from "@/components/flame-ring";
import { teamColorsSoon } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

interface Aura {
  icons: string[]; // sırayla tekrarlanır
  colors: string[]; // fırıldağın dilimleri (2 ya da 3 renk)
  // Simge emoji değil düz karakterse (★, ☾) sticker'ın zemin ve simge rengi; böylece simge takımın renginde olur
  sticker?: { bg: string; color: string };
}

const RED = "#e3262e";
const WHITE = "#ffffff";
const INK = "#1a1a1a";

// Anahtar: BSD takım kimliği
const AURAS: Record<number, Aura> = {
  // Kulüpler
  125: { icons: ["🦁"], colors: ["#fdb912", "#a90432"] }, // Galatasaray · Aslan
  134: { icons: ["🐤"], colors: ["#ffed00", "#163962"] }, // Fenerbahçe · Kanarya
  196: { icons: ["🦅"], colors: [INK, WHITE] }, // Beşiktaş · Kara Kartal
  197: { icons: ["⚡", "🌊"], colors: ["#7a1f3d", "#5ab4e5"] }, // Trabzonspor · Karadeniz Fırtınası
  155: { icons: ["🐓"], colors: [INK, WHITE] }, // Atlético Mineiro · Galo
  164: { icons: ["⛵"], colors: [INK, WHITE] }, // Vasco da Gama · karavela
  194: { icons: ["🦉"], colors: ["#f26522", "#1b2a5c"] }, // Başakşehir · baykuş
  190: { icons: ["🦁"], colors: ["#ffd200", "#e30613"] }, // Göztepe · Göz-Göz
  184: { icons: ["⚓"], colors: ["#e30613", WHITE] }, // Samsunspor · Karadeniz
  192: { icons: ["🦅"], colors: ["#1f8a4c", WHITE] }, // Konyaspor · kartal
  189: { icons: ["🍵"], colors: ["#1f8a4c", "#1d3a8a"] }, // Çaykur Rizespor · çay
  186: { icons: ["🍊"], colors: [RED, WHITE] }, // Antalyaspor · portakal
  // İngiltere
  1: { icons: ["🐦"], colors: ["#c8102e", WHITE] }, // Liverpool · Liver kuşu
  12: { icons: ["⛵", "🐝"], colors: ["#6cabdd", WHITE] }, // Manchester City · gemi, arı
  17: { icons: ["😈"], colors: ["#da291c", INK] }, // Manchester United · Kızıl Şeytanlar
  18: { icons: ["💣"], colors: ["#ef0107", WHITE] }, // Arsenal · Topçular
  13: { icons: ["🦁"], colors: ["#034694", WHITE] }, // Chelsea · aslan
  9: { icons: ["🐓"], colors: [WHITE, "#132257"] }, // Tottenham · horoz
  4: { icons: ["🏰"], colors: [INK, WHITE] }, // Newcastle · Saksağanlar, kale
  3: { icons: ["🦁"], colors: ["#670e36", "#95bfe5"] }, // Aston Villa · aslan
  8: { icons: ["⚒️"], colors: ["#7a263a", "#1bb1e7"] }, // West Ham · Çekiçler
  11: { icons: ["🐺"], colors: ["#fdb913", INK] }, // Wolverhampton · Kurtlar
  14: { icons: ["🦅"], colors: ["#1b458f", "#c4122e"] }, // Crystal Palace · kartal
  5: { icons: ["🕊️"], colors: ["#0057b8", WHITE] }, // Brighton · Martılar
  15: { icons: ["🌳", "🏹"], colors: ["#dd0000", WHITE] }, // Nottingham Forest · Robin Hood
  20: { icons: ["🍬"], colors: ["#003399", WHITE] }, // Everton · Toffees
  // İspanya
  57: { icons: ["👑"], colors: [WHITE, "#febe10"] }, // Real Madrid · taç
  44: { icons: ["🔵", "🔴"], colors: ["#004d98", "#a50044"] }, // Barcelona · Blaugrana
  54: { icons: ["🐻"], colors: ["#cb3524", WHITE, "#272e61"] }, // Atlético Madrid · ayı ve kocayemiş ağacı
  51: { icons: ["🦁"], colors: ["#ee2523", WHITE, INK] }, // Athletic Club · Aslanlar
  52: { icons: ["🔥"], colors: [WHITE, "#d6001c"] }, // Sevilla
  56: { icons: ["🌿"], colors: ["#00954c", WHITE] }, // Real Betis · Verdiblancos
  47: { icons: ["🦇"], colors: [WHITE, INK, "#ee3524"] }, // Valencia · yarasa
  41: { icons: ["🚤"], colors: ["#ffe667", "#005187"] }, // Villarreal · Sarı Denizaltı
  // İtalya
  73: { icons: ["🦓"], colors: [INK, WHITE] }, // Juventus · zebra
  77: { icons: ["🐍"], colors: ["#0068a8", INK] }, // Inter · yılan
  63: { icons: ["😈"], colors: ["#fb090b", INK] }, // Milan · Rossoneri şeytanı
  62: { icons: ["🫏", "🌋"], colors: ["#12a0d7", WHITE] }, // Napoli · eşek, Vezüv
  65: { icons: ["🐺"], colors: ["#8e1f2f", "#f0bc42"] }, // Roma · dişi kurt
  70: { icons: ["🦅"], colors: ["#87d8f7", WHITE] }, // Lazio · kartal
  71: { icons: ["👸"], colors: ["#1e71b8", INK] }, // Atalanta · Atalanta
  68: { icons: ["⚜️"], colors: ["#482e92", WHITE] }, // Fiorentina · zambak
  // Almanya
  79: { icons: ["🍺", "🥨"], colors: ["#dc052d", WHITE] }, // Bayern · Bavyera
  92: { icons: ["🐝"], colors: ["#fde100", INK] }, // Dortmund · arılar
  85: { icons: ["💊"], colors: ["#e32221", INK] }, // Leverkusen · Aspirin
  80: { icons: ["🐂"], colors: [WHITE, "#dd0741"] }, // Leipzig · boğa
  87: { icons: ["🦅"], colors: ["#e1000f", INK] }, // Frankfurt · kartal
  // Fransa
  114: { icons: ["🗼"], colors: ["#004170", "#da291c"] }, // PSG · Eyfel
  98: { icons: ["⛵"], colors: ["#2faee0", WHITE] }, // Marsilya · liman
  100: { icons: ["🦁"], colors: [WHITE, "#da0812", "#14387f"] }, // Lyon · aslan
  101: { icons: ["👑"], colors: ["#e7000e", WHITE] }, // Monaco · Prenslik tacı
  // Portekiz, Hollanda, İskoçya, diğer Avrupa
  37: { icons: ["🦅"], colors: ["#e83030", WHITE] }, // Benfica · kartal
  35: { icons: ["🐉"], colors: ["#00428c", WHITE] }, // Porto · ejderha
  22: { icons: ["🦁"], colors: ["#008057", WHITE] }, // Sporting · aslan
  122: { icons: ["🛡️"], colors: [WHITE, "#d2122e"] }, // Ajax · savaşçı
  115: { icons: ["💡"], colors: ["#ed1c24", WHITE] }, // PSV · Philips ampulü
  138: { icons: ["⚓"], colors: ["#e30613", WHITE] }, // Feyenoord · Rotterdam limanı
  132: { icons: ["☘️"], colors: ["#018749", WHITE] }, // Celtic · yonca
  145: { icons: ["🦁"], colors: ["#1b458f", WHITE, RED] }, // Rangers · aslan
  118: { icons: ["🏛️"], colors: ["#e30613", WHITE] }, // Olympiakos · Pire
  149: { icons: ["☘️"], colors: ["#007a3d", WHITE] }, // Panathinaikos · yonca
  124: { icons: ["🦁"], colors: [WHITE, "#0f2b5b"] }, // Kopenhag · aslanlar
  123: { icons: ["🐻"], colors: ["#0078c8", INK] }, // Club Brugge
  147: { icons: ["🐂"], colors: [WHITE, "#d6001c"] }, // Salzburg · boğa
  // Güney Amerika, Suudi Arabistan, ABD
  780: { icons: ["⚓"], colors: ["#0033a0", "#ffcc00"] }, // Boca Juniors · Xeneizes, liman
  755: { icons: ["🐔"], colors: [WHITE, "#e2001a"] }, // River Plate · tavuk
  160: { icons: ["🦅"], colors: ["#e20e0e", INK] }, // Flamengo · Urubu
  162: { icons: ["🐷"], colors: ["#006437", WHITE] }, // Palmeiras · domuz
  167: { icons: ["🦅"], colors: [INK, WHITE] }, // Corinthians
  165: { icons: ["🐋"], colors: [WHITE, INK] }, // Santos · balina
  158: { icons: ["⛪"], colors: [RED, WHITE, INK] }, // São Paulo · aziz
  267: { icons: ["☀️"], colors: ["#fcd116", "#1e3f94"] }, // Al-Nassr · güneş
  262: { icons: ["🌙"], colors: ["#1e4ea1", WHITE] }, // Al-Hilal · hilal
  293: { icons: ["🦩"], colors: ["#f7b5cd", INK] }, // Inter Miami · flamingo
  300: { icons: ["⭐"], colors: ["#00245d", "#ffd200"] }, // LA Galaxy · yıldızlar
  // Milli takımlar
  932: { icons: ["☾", "★"], colors: [RED, WHITE], sticker: { bg: RED, color: WHITE } }, // Türkiye · Ay-Yıldızlılar (bayraktaki gibi kırmızı üstüne beyaz)
  475: { icons: ["🐂"], colors: [RED, "#ffd23f"] }, // İspanya · boğa
  493: { icons: ["🦁"], colors: [WHITE, RED] }, // İngiltere · Üç Aslan
  485: { icons: ["🐓"], colors: ["#2447b3", WHITE, RED] }, // Fransa · Galya horozu
  477: { icons: ["😈"], colors: [INK, "#ffd23f", RED] }, // Belçika · Kırmızı Şeytanlar
  1326: { icons: ["🍕"], colors: ["#1f6fd6", WHITE] }, // İtalya · pizza, Gök Mavililer'in mavisi
  494: { icons: ["🟥", "⬜"], colors: [RED, WHITE] }, // Hırvatistan · dama
  930: { icons: ["🦁"], colors: [RED, WHITE, "#2447b3"] }, // Çekya · çift kuyruklu aslan
  488: { icons: ["🪓", "🛡️"], colors: [RED, "#1d2f6f", WHITE] }, // Norveç · Vikingler
  665: { icons: ["🪓", "🌋"], colors: ["#1f4fa8", WHITE, RED] }, // İzlanda · Vikingler
  467: { icons: ["🦅"], colors: [INK, RED, "#ffce00"] }, // Almanya · kartal
  469: { icons: ["🦁", "🌷"], colors: ["#ff7a1a", WHITE] }, // Hollanda · Portakallar
  462: { icons: ["🏔️"], colors: [RED, WHITE] }, // İsviçre · Alpler
  466: { icons: ["🦄"], colors: ["#1d3a8a", WHITE] }, // İskoçya · ulusal hayvanı tek boynuzlu at
  702: { icons: ["⛵"], colors: ["#1f6fd6", WHITE] }, // Yunanistan · Korsan Gemisi
  675: { icons: ["🦅"], colors: [RED, "#1d3a8a", WHITE] }, // Sırbistan · Kartallar
  725: { icons: ["🦅"], colors: [WHITE, "#1f4fa8", RED] }, // Slovakya · Şahinler
  715: { icons: ["🏔️"], colors: [WHITE, "#1f6fd6", "#3fae5a"] }, // Slovenya · Triglav
  491: { icons: ["⚓", "🧭"], colors: [RED, "#1f8a4c"] }, // Portekiz · denizciler
  463: { icons: ["🐤"], colors: ["#ffdf00", "#1f9d55"] }, // Brezilya · Canarinho
  489: { icons: ["☀️"], colors: ["#75aadb", WHITE] }, // Arjantin · Mayıs Güneşi
  480: { icons: ["☀️"], colors: ["#5eb6e4", WHITE] }, // Uruguay · Celeste
  498: { icons: ["☕"], colors: ["#fcd116", "#003893", "#ce1126"] }, // Kolombiya · kahve
  936: { icons: ["🌶️"], colors: ["#d52b1e", WHITE, "#0039a6"] }, // Şili · La Roja
  472: { icons: ["🦅"], colors: ["#ffdd00", "#034ea2", "#ed1c24"] }, // Ekvador · And kondoru
  713: { icons: ["🦙"], colors: ["#d91023", WHITE] }, // Peru · lama
  458: { icons: ["🌟"], colors: [RED, WHITE, "#0038a8"] }, // Paraguay · Albirroja
  451: { icons: ["🌵", "🌮"], colors: ["#006847", WHITE, "#ce1126"] }, // Meksika · El Tri
  457: { icons: ["🦅", "⭐"], colors: ["#0a3161", WHITE, "#b31942"] }, // ABD · kartal
  455: { icons: ["🍁"], colors: ["#d80621", WHITE] }, // Kanada · akçaağaç
  470: { icons: ["🗾", "🌸"], colors: ["#1d3a8a", WHITE] }, // Japonya · Samuraylar
  453: { icons: ["🐯"], colors: ["#c60c30", WHITE] }, // Güney Kore · Kaplanlar
  459: { icons: ["🦘"], colors: ["#ffcd00", "#00843d"] }, // Avustralya · Socceroos
  479: { icons: ["🌴"], colors: ["#006c35", WHITE] }, // Suudi Arabistan · Yeşil Şahinler
  481: { icons: ["🐆"], colors: [WHITE, "#239f40", "#da0000"] }, // İran · Pers çitası
  461: { icons: ["🐪"], colors: ["#8a1538", WHITE] }, // Katar
  464: { icons: ["🦁"], colors: ["#c1272d", "#006233"] }, // Fas · Atlas Aslanları
  486: { icons: ["🦁"], colors: ["#00853f", "#fdef42", "#e31b23"] }, // Senegal · Teranga Aslanları
  651: { icons: ["🦅"], colors: ["#008751", WHITE] }, // Nijerya · Süper Kartallar
  658: { icons: ["🦁"], colors: ["#007a5e", "#ce1126", "#fcd116"] }, // Kamerun · Yenilmez Aslanlar
  478: { icons: ["🐫", "🔺"], colors: ["#ce1126", WHITE, INK] }, // Mısır · Firavunlar
  495: { icons: ["⭐"], colors: ["#ce1126", "#fcd116", "#006b3f"] }, // Gana · Kara Yıldızlar
  471: { icons: ["🐘"], colors: ["#f77f00", WHITE, "#009e60"] }, // Fildişi Sahili · Filler
  490: { icons: ["🦊"], colors: ["#006233", WHITE] }, // Cezayir · Çöl Tilkileri
  474: { icons: ["🦅"], colors: ["#e70013", WHITE] }, // Tunus · Kartacalı Kartallar
  2028: { icons: ["🦅"], colors: [WHITE, "#dc143c"] }, // Polonya · Beyaz Kartal
  723: { icons: ["🌻"], colors: ["#0057b7", "#ffd700"] }, // Ukrayna · ayçiçeği
  1327: { icons: ["🧱", "🪓"], colors: ["#c8102e", WHITE] }, // Danimarka · Danimarka Dinamitleri
  731: { icons: ["👑"], colors: ["#006aa7", "#fecc00"] }, // İsveç · Üç Taç
  483: { icons: ["🏔️", "🎻"], colors: ["#ed2939", WHITE] }, // Avusturya · Alpler
  714: { icons: ["🌶️"], colors: ["#ce2939", WHITE, "#477050"] }, // Macaristan · paprika
  726: { icons: ["🦇"], colors: ["#002b7f", "#fcd116", "#ce1126"] }, // Romanya · Drakula
  727: { icons: ["🐉"], colors: ["#c8102e", WHITE, "#00a651"] }, // Galler · Kızıl Ejderha
  729: { icons: ["☘️"], colors: ["#169b62", WHITE, "#ff883e"] }, // İrlanda · yonca
  728: { icons: ["✋"], colors: ["#00a651", WHITE] }, // Kuzey İrlanda · Kızıl El
  721: { icons: ["🦢", "❄️"], colors: [WHITE, "#002f6c"] }, // Finlandiya
  724: { icons: ["🦅"], colors: ["#e41e20", INK] }, // Arnavutluk · çift başlı kartal
  678: { icons: ["🍇"], colors: [WHITE, "#ff0000"] }, // Gürcistan · bağlar
  931: { icons: ["⚜️"], colors: ["#002395", "#fecb00"] }, // Bosna-Hersek · zambak
  2090: { icons: ["🦁"], colors: [WHITE, "#00966e", "#d62612"] }, // Bulgaristan · aslan
  700: { icons: ["🦅"], colors: ["#c40308", "#d4af37"] }, // Karadağ
  730: { icons: ["☀️"], colors: ["#d20000", "#ffe600"] }, // Kuzey Makedonya · güneş
  697: { icons: ["🐻"], colors: [WHITE, "#0039a6", "#d52b1e"] }, // Rusya · ayı
};

const STICKERS = 6;
const ORBIT = 41; // sticker merkezlerinin yarıçapı, kapsayıcının yüzdesi

// Dilimler 360°'yi tam böler ki fırıldak dönerken ek yeri görünmesin
function pinwheel(colors: string[]): string {
  const slice = colors.length === 3 ? 20 : 15;
  return `repeating-conic-gradient(${colors.map((c, i) => `${c} ${i * slice}deg ${(i + 1) * slice}deg`).join(", ")})`;
}

export async function TeamAura({ teamId, className }: { teamId: number; className?: string }) {
  const aura = AURAS[teamId];
  if (!aura) {
    // Simgesi olmayan takım: yalnızca takım renklerinde fırıldak
    const colors = await teamColorsSoon(teamId);
    if (!colors) return <FlameRing className={className} />;
    return (
      <span className={cn("team-aura pointer-events-none block", className)} aria-hidden="true">
        <span className="aura-burst aura-burst-solo" style={{ background: pinwheel(colors) }} />
      </span>
    );
  }
  const stickerStyle: CSSProperties | undefined = aura.sticker && { background: aura.sticker.bg, color: aura.sticker.color, fontVariantEmoji: "text" };
  return (
    <span className={cn("team-aura pointer-events-none block", className)} aria-hidden="true">
      <span className="aura-burst" style={{ background: pinwheel(aura.colors) }} />
      <span className="aura-orbit">
        {Array.from({ length: STICKERS }, (_, i) => {
          const angle = ((360 / STICKERS) * i - 90) * (Math.PI / 180);
          const style: CSSProperties = {
            left: `${(50 + ORBIT * Math.cos(angle)).toFixed(2)}%`,
            top: `${(50 + ORBIT * Math.sin(angle)).toFixed(2)}%`,
          };
          return (
            <span key={i} className="aura-slot" style={style}>
              <span className="aura-upright">
                <span className="aura-sticker size-7 text-sm sm:size-14 sm:text-3xl" style={{ ...stickerStyle, animationDelay: `${-(i % 3) * 0.3}s` }}>
                  {aura.icons[i % aura.icons.length]}
                </span>
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
