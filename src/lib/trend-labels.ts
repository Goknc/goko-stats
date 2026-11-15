// src/lib/trend-labels.ts
// Trend adlarının maça özel yazımı. Tek takıma bakan trendlerde ("Ev sahibi kazandı") genel ifade yerine
// takımın adı yazılır ve rakibin satırı aynı olayı kendi açısından söyler:
// "Letonya kazandı" kartında Ermenistan satırı "Kaybetti" der; kimse "Ermenistan ev sahibi olarak kazandı" diye okumaz.
import type { TrendSide } from "./engine/side";

interface TrendLike {
  code: string;
  name: string;
  side: TrendSide | null;
  line: number | null;
}

// Kart / başlık adı: "Ev sahibi 2+ gol" → "Letonya 2+ gol"
export function trendTitle(t: TrendLike, home: string, away: string): string {
  if (t.side === "HOME") return t.name.replace(/^Ev sahibi/, home);
  if (t.side === "AWAY") return t.name.replace(/^Deplasman/, away);
  return t.name;
}

// Takım satırının açıklaması; iki takımı birlikte ilgilendiren trendlerde (toplam gol, korner...) yok
export function sideCaption(t: TrendLike, which: "home" | "away"): string | null {
  if (!t.side) return null;
  const own = (t.side === "HOME") === (which === "home");
  if (t.code.endsWith("_WIN")) return own ? "Kazandı" : "Kaybetti";
  if (t.line !== null) return own ? `${t.line}+ gol attı` : `${t.line}+ gol yedi`;
  return null;
}
