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
