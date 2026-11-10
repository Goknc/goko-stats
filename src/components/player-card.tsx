// Oyuncu kartı: seçilen trendde (Gol 1+, Faul 2+...) kayıt, isabet, ortalama ve maç maç sütunlar.
// Sütunlar soldan sağa eskiden yeniye; açılışta en yeni maça kaydırılır.
// Yalnızca karneye sayılan ilk 11 maçları (60+ dk kuralı). Yeşil = çizgiyi geçti, kırmızı = geçmedi.
// Oyuncu takım değiştirdiyse sütunlar takıma göre gruplanır, araya çizgi çekilir.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PlayerGame } from "@/lib/analysis";
import type { PlayerStatKey } from "@/lib/engine/trends";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { StreakBadges } from "@/components/streak-badges";
import { currentStreaks } from "@/lib/engine/streaks";
import { TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface CardTrend {
  code: string;
  name: string;
  statKey: PlayerStatKey;
  line: number;
  threshold: number;
  rate: number | null;
  hits: number;
  total: number;
  lowSample: boolean;
}

interface PlayerCardProps {
  playerId: number;
  name: string;
  position: string | null;
  teamId: number;
  teamName: string;
  games: PlayerGame[]; // en yeniden eskiye
  trends: CardTrend[];
  defaultCode: string;
  featured?: string[]; // hızlı geçiş düğmeleri (öne çıkan ya da en çok tutan trendler)
  badge?: string; // ismin yanında küçük etiket ("2 öne çıkan", "az veri")
  injury?: string | null; // "Sakat · Hamstring"
  className?: string;
}

const POSITIONS: Record<string, string> = { G: "KL", D: "DF", M: "OS", F: "FV" };

// "Brighton & Hove Albion" → "BRI", "FC Porto" → "POR"
const SKIP = new Set(["FC", "CF", "AFC", "AC", "SC", "SK", "FK", "CD", "SD", "UD", "RC", "AS", "SS", "SV", "VFB", "VFL", "TSG", "1.", "REAL"]);
function shortName(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const word = words.find((w) => !SKIP.has(w.toLocaleUpperCase("tr")) && w.length > 2) ?? words[0] ?? name;
  return word.slice(0, 3).toLocaleUpperCase("tr");
}

const pct = (r: number | null) => (r === null ? "–" : `%${Math.round(r * 100)}`);
const formatDate = (t: number) => new Date(t).toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit" });

function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="text-right">
      <div className={cn("text-xl font-extrabold tabular-nums leading-none sm:text-2xl", className)}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function PlayerCard({
  playerId, name, position, teamId, teamName, games, trends, defaultCode, featured = [], badge, injury, className,
}: PlayerCardProps) {
  const [code, setCode] = useState(defaultCode);
  const [showAll, setShowAll] = useState(false);
  const trend = trends.find((m) => m.code === code) ?? trends[0];
  const scroller = useRef<HTMLDivElement>(null);

  // En yeni maç sağda: ilk görünür olduğunda sona kaydır (kapalı <details> içindeki kart açılınca da)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === 0) return;
      el.scrollLeft = el.scrollWidth;
      observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Eskiden yeniye, ardışık aynı takım maçları bir grup
  const groups = useMemo(() => {
    const out: { teamId: number; teamName: string; games: PlayerGame[] }[] = [];
    for (const g of [...games].reverse()) {
      const last = out.at(-1);
      if (last && last.teamId === g.teamId) last.games.push(g);
      else out.push({ teamId: g.teamId, teamName: g.teamName, games: [g] });
    }
    return out;
  }, [games]);
  const transferred = groups.length > 1;
  // Süren seriler (karneye sayılan ilk 11 maçları, en yeniden eskiye); kartta en uzun ikisi
  const streaks = useMemo(
    () => currentStreaks(games.map((g) => ({ started: true, minutes: g.minutes, stats: g.stats })), { position }).slice(0, 2),
    [games, position],
  );

  if (!trend) return null;
  const avg = games.length ? games.reduce((n, g) => n + g.stats[trend.statKey], 0) / games.length : null;
  const passes = !trend.lowSample && trend.rate !== null && trend.rate >= trend.threshold;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-linear-to-b from-card to-background/60", className)}>
      {/* Üst: oyuncu + trend seçici */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <PlayerPhoto id={playerId} name={name} size={52} className="ring-2 ring-border" />
            {position && POSITIONS[position] && (
              <span className="absolute -bottom-1 -left-1 rounded-full border border-border bg-background px-1.5 text-[10px] font-bold">
                {POSITIONS[position]}
              </span>
            )}
            <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
              <TeamLogo id={teamId} name={teamName} size={16} />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/players/${playerId}`} className="truncate text-lg font-bold leading-tight hover:text-primary">{name}</Link>
              {badge && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    badge === "az veri" ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary",
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            <div className="truncate text-sm text-primary">{teamName}</div>
            {injury && (
              <span className="mt-1 inline-block rounded-full border border-miss/50 bg-miss/10 px-2 py-0.5 text-[11px] font-semibold text-miss">
                {injury}
              </span>
            )}
            <StreakBadges streaks={streaks} size="sm" className="mt-1" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={trend.code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Trend"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium"
          >
            {trends.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name} · {m.total ? pct(m.rate) : "–"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hızlı geçiş */}
      {featured.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {featured.map((c) => {
            const m = trends.find((x) => x.code === c);
            if (!m) return null;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCode(c)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                  c === trend.code ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {m.name} {pct(m.rate)}
              </button>
            );
          })}
        </div>
      )}

      {/* Başlık + özet */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-4">
        <div>
          <div className="text-lg font-extrabold uppercase tracking-wide text-primary">{trend.name}</div>
          <div className="text-xs text-muted-foreground">
            eşik {pct(trend.threshold)}
            {trend.lowSample && " · az örnek"}
          </div>
        </div>
        <div className="flex gap-5 sm:gap-7">
          <Stat label="Kayıt" value={`${trend.hits}/${trend.total}`} className={passes ? "text-hit" : undefined} />
          <Stat label="İsabet" value={pct(trend.rate)} className={passes ? "text-hit" : undefined} />
          <Stat label="Ort." value={avg === null ? "–" : avg.toFixed(2)} />
        </div>
      </div>

      {/* Maç sütunları */}
      <div ref={scroller} className="mt-4 overflow-x-auto px-4 pb-3 scrollbar-thin">
        <div className="flex w-max gap-3">
          {groups.map((grp, gi) => (
            <div key={gi} className={cn("flex flex-col gap-1.5", gi > 0 && "border-l-2 border-dashed border-primary/50 pl-3")}>
              {transferred && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <TeamLogo id={grp.teamId} name={grp.teamName} size={14} />
                  <span className="truncate">{grp.teamName}</span>
                  <TeamRecord games={grp.games} statKey={trend.statKey} line={trend.line} />
                </div>
              )}
              <div className="flex gap-1.5">
                {grp.games.map((g) => (
                  <GameColumn key={g.matchId} game={g} statKey={trend.statKey} line={trend.line} />
                ))}
              </div>
            </div>
          ))}
          {games.length === 0 && <p className="py-6 text-sm text-muted-foreground">Bu oyuncu için maç verisi yok.</p>}
        </div>
      </div>

      {/* Alt: açıklama + tüm trendler */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="flex flex-wrap items-center gap-3">
          <Legend className="bg-hit-block" text="geçti" />
          <Legend className="bg-miss-block" text="geçmedi" />
        </span>
        <button type="button" onClick={() => setShowAll((v) => !v)} className="hover:text-foreground">
          {showAll ? "Gizle" : "Tüm trendler"}
        </button>
      </div>
      {showAll && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1.5 px-4 pb-4">
          {trends.map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => setCode(m.code)}
              className={cn(
                "flex items-baseline justify-between rounded-md px-2.5 py-1.5 text-left text-sm",
                m.code === trend.code ? "bg-primary/15 ring-1 ring-primary" : "bg-secondary/60 hover:bg-secondary",
              )}
            >
              <span className="text-muted-foreground">{m.name}</span>
              <span className={cn("tabular-nums font-bold", (m.rate ?? 0) === 0 && "font-normal text-muted-foreground/60")}>
                {m.total === 0 ? "–" : m.lowSample ? `${m.hits}/${m.total}` : pct(m.rate)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Transferde takım başına performans: "· 6/11 %55"
function TeamRecord({ games, statKey, line }: { games: PlayerGame[]; statKey: PlayerStatKey; line: number }) {
  const hits = games.filter((g) => g.stats[statKey] >= line).length;
  return (
    <span className="tabular-nums text-muted-foreground/70">
      · {hits}/{games.length}
      {games.length > 0 && <strong className="ml-1 text-foreground/80">{pct(hits / games.length)}</strong>}
    </span>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} />
      {text}
    </span>
  );
}

function GameColumn({ game: g, statKey, line }: { game: PlayerGame; statKey: PlayerStatKey; line: number }) {
  const value = g.stats[statKey];
  const hit = value >= line;
  const s = g.stats;
  const title =
    `${formatDate(g.date)} · ${g.isHome ? "Ev" : "Dep"} · ${g.teamName} ${g.score} ${g.opponentName} · ${g.minutes}'` +
    "\n" +
    `${s.goals}G ${s.assists}A · şut ${s.shotsOnTarget}/${s.shotsTotal} · ${s.tackles} top kapma · ${s.fouls} faul` +
    (s.yellowCards ? " · sarı kart" : "");
  return (
    <div
      title={title}
      className={cn(
        "flex w-15 shrink-0 flex-col items-center gap-1 rounded-xl border px-1 pt-1.5 pb-2",
        hit ? "border-hit/50 bg-hit/12" : "border-miss/40 bg-miss/8",
      )}
    >
      <span
        className={cn(
          "rounded px-1 text-[10px] font-bold leading-4",
          g.isHome ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground",
        )}
      >
        {g.isHome ? "EV" : "DEP"}
      </span>
      <span
        className={cn(
          "text-2xl font-extrabold tabular-nums leading-none",
          hit ? "text-hit" : "text-miss",
        )}
      >
        {value}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{g.minutes}&apos;</span>
      <span className="mt-0.5 flex flex-col items-center gap-0.5 rounded-md bg-background/70 px-1.5 py-1">
        <TeamLogo id={g.opponentId} name={g.opponentName} size={18} />
        <span className="text-[10px] font-bold tracking-wide">{shortName(g.opponentName)}</span>
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground/80">{formatDate(g.date)}</span>
    </div>
  );
}
