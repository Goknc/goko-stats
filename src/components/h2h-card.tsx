// Maç detayı: aralarındaki maçlar kartı. Bakış açısı ev sahibi (A).
// Saha (tümü / A evinde / B evinde) ve maç sayısı (son 5 / 10 / 20 / tümü) adres çubuğundan seçilir; özet seçilen maçlardan.
import { H2H_LAST_OPTIONS, type H2HFilter, type H2HSummary, type Streak } from "@/lib/engine/h2h";
import { H2H_PLAYER_MIN_GAMES, type H2HPlayers, type H2HPlayerSummary } from "@/lib/engine/h2h-players";
import Link from "next/link";
import { TZ } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/segmented";
import { TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

const shortDate = (d: Date) => d.toLocaleDateString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });

const GOAL_LABELS = { over25: "3+ gol", under25: "en fazla 2 gol", btts: "iki takım da gol attı", noBtts: "en az bir takım gol atamadı" } as const;

// Seriyi cümleye çevirir. "venue" serileri A'nın iç saha maçlarıdır (B için deplasman), "away" serileri B'nin evindeki maçlar.
export function streakText(s: Streak, a: string, b: string): string {
  const n = s.length;
  if (s.kind in GOAL_LABELS) {
    const label = GOAL_LABELS[s.kind as keyof typeof GOAL_LABELS];
    if (s.scope === "all") return `Son ${n} karşılaşmada ${label}`;
    return `${s.scope === "venue" ? a : b} evindeki son ${n} karşılaşmada ${label}`;
  }
  if (s.scope === "all") {
    switch (s.kind) {
      case "wins": return `Son ${n} karşılaşmayı ${a} kazandı`;
      case "unbeaten": return `${a} son ${n} karşılaşmada yenilmedi`;
      case "losses": return `Son ${n} karşılaşmayı ${b} kazandı`;
      case "winless": return `${b} son ${n} karşılaşmada yenilmedi`;
    }
  }
  if (s.scope === "away") {
    switch (s.kind) {
      case "wins": return `${a} deplasmanda son ${n} karşılaşmayı kazandı`;
      case "unbeaten": return `${a} deplasmanda son ${n} karşılaşmada yenilmedi`;
      case "losses": return `${b} evinde son ${n} karşılaşmayı kazandı`;
      case "winless": return `${b} evinde son ${n} karşılaşmada yenilmedi`;
    }
  }
  switch (s.kind) {
    case "wins": return `${a} evinde son ${n} karşılaşmayı kazandı`;
    case "unbeaten": return `${a} evinde son ${n} karşılaşmada yenilmedi`;
    case "losses": return `${b} deplasmanda son ${n} karşılaşmayı kazandı`;
    case "winless": return `${b} deplasmanda son ${n} karşılaşmada yenilmedi`;
  }
  return "";
}

interface H2HCardProps {
  h: H2HSummary;
  home: { id: number; name: string };
  away: { id: number; name: string };
  players?: H2HPlayers | null; // oyuncu verisi yoksa bölüm görünmez
  filterHref?: (f: H2HFilter) => string; // verilirse saha ve maç sayısı seçicileri görünür
}

const LAST_KEYS = [...H2H_LAST_OPTIONS.map(String), "all"] as const;
type LastKey = (typeof LAST_KEYS)[number];

export function H2HCard({ h, home, away, players, filterHref }: H2HCardProps) {
  const n = h.all.total;
  const nameOf = (id: number) => (id === home.id ? home.name : away.name);
  const pct = (x: number) => (n ? (x / n) * 100 : 0);
  const { filter } = h;
  const lastKey = (filter.last === null ? "all" : String(filter.last)) as LastKey;
  const venueText = filter.venue === "home" ? `${home.name} evinde` : filter.venue === "away" ? `${away.name} evinde` : "tüm turnuvalar";
  const sampleText = filter.last !== null && h.available > n ? `Son ${n} maç (toplam ${h.available})` : `${n} maç`;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-row flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-xl">Aralarındaki maçlar</CardTitle>
          <span className="text-sm font-medium text-muted-foreground">{n ? `${sampleText} · ${venueText}` : ""}</span>
        </div>
        {filterHref && h.oldest && (
          <div className="flex flex-wrap gap-2">
            <Segmented
              options={[
                { key: "all", label: "Tümü" },
                { key: "home", label: `${home.name} evinde` },
                { key: "away", label: `${away.name} evinde` },
              ]}
              value={filter.venue}
              href={(venue) => filterHref({ ...filter, venue })}
            />
            <Segmented
              options={LAST_KEYS.map((k) => ({ key: k, label: k === "all" ? "Tümü" : `Son ${k}` }))}
              value={lastKey}
              href={(k) => filterHref({ ...filter, last: k === "all" ? null : Number(k) })}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {n === 0 ? (
          <p className="text-muted-foreground">
            {h.oldest ? "Bu seçime uyan karşılaşma yok." : "Bu iki takımın kayıtlı bir karşılaşması yok."}
          </p>
        ) : (
          <>
            {/* Karne */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 text-center">
                <div>
                  <div className="poster text-5xl leading-none tabular-nums text-home-text">{h.all.wins}</div>
                  <div className="mt-1 truncate text-sm font-bold">{home.name}</div>
                </div>
                <div>
                  <div className="poster text-5xl leading-none tabular-nums">{h.all.draws}</div>
                  <div className="mt-1 text-sm font-bold">Beraberlik</div>
                </div>
                <div>
                  <div className="poster text-5xl leading-none tabular-nums text-away-text">{h.all.losses}</div>
                  <div className="mt-1 truncate text-sm font-bold">{away.name}</div>
                </div>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full border-2 border-foreground bg-secondary" aria-hidden="true">
                <div className="bg-home" style={{ width: `${pct(h.all.wins)}%` }} />
                <div className="bg-[var(--yellow)]" style={{ width: `${pct(h.all.draws)}%` }} />
                <div className="bg-away" style={{ width: `${pct(h.all.losses)}%` }} />
              </div>
            </div>

            {/* Özet sayılar */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Maç başına gol" value={((h.goalsFor + h.goalsAgainst) / n).toFixed(1).replace(".", ",")} />
              <Stat label="İki takım da gol attı" value={`${h.btts}/${n}`} />
              <Stat label="3+ gol" value={`${h.over25}/${n}`} />
              {filter.venue === "away" ? (
                // B'nin evindeki karne, B'nin gözünden
                <Stat label={`${away.name} evinde`} value={`${h.all.losses}G ${h.all.draws}B ${h.all.wins}M`} />
              ) : (
                <Stat
                  label={`${home.name} evinde`}
                  value={h.venue.total ? `${h.venue.wins}G ${h.venue.draws}B ${h.venue.losses}M` : "–"}
                />
              )}
            </div>

            {/* Seriler */}
            {h.streaks.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {h.streaks.map((s) => (
                  <li key={`${s.scope}-${s.kind}`} className="rounded-full border-2 border-foreground bg-[var(--yellow)] px-3 py-0.5 text-sm font-bold">
                    {streakText(s, home.name, away.name)}
                  </li>
                ))}
              </ul>
            )}

            {/* Son karşılaşmalar */}
            <ul className="divide-y-2 divide-dashed divide-border">
              {h.games.map((g) => {
                // Kazanan takımın adı karnedeki rengiyle (ev sahibi mavi, rakip kırmızı); beraberlikte renk yok
                const winner = g.result === "W" ? home.id : g.result === "L" ? away.id : null;
                const teamName = (id: number) => (
                  <span
                    className={cn(
                      id === winner && "font-bold",
                      id === winner && (id === home.id ? "text-home-text" : "text-away-text"),
                    )}
                  >
                    {nameOf(id)}
                  </span>
                );
                return (
                  <li key={g.match.id}>
                    <Link href={`/matches/${g.match.id}`} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-[var(--yellow)]">
                    <span className="text-sm tabular-nums text-muted-foreground">{shortDate(g.match.eventDate)}</span>
                    <span className="min-w-0">
                      <span className="block truncate">
                        {teamName(g.match.homeTeamId)}{" "}
                        <strong className="tabular-nums">
                          {g.match.homeScore}-{g.match.awayScore}
                        </strong>{" "}
                        {teamName(g.match.awayTeamId)}
                      </span>
                      {g.match.competition && (
                        <span className="block truncate text-xs text-muted-foreground">{g.match.competition}</span>
                      )}
                    </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {players && <H2HPlayersSection p={players} home={home} away={away} />}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-secondary px-3 py-2">
      <div className="truncate text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="poster text-2xl tabular-nums">{value}</div>
    </div>
  );
}

// Bu eşleşmede gol / asistiyle öne çıkan, hâlâ takımda olan oyuncular
function H2HPlayersSection({ p, home, away }: { p: H2HPlayers; home: { id: number; name: string }; away: { id: number; name: string } }) {
  const empty = p.home.length === 0 && p.away.length === 0;
  return (
    <div className="space-y-2 border-t-2 border-dashed border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="poster text-xl">Bu eşleşmede öne çıkan oyuncular</h3>
        <span className="text-xs text-muted-foreground">
          Son {p.matches} karşılaşmanın en az {H2H_PLAYER_MIN_GAMES} tanesinde gol ya da asist
        </span>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">Bu eşleşmede öne çıkan oyuncu yok.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <PlayerList team={home} players={p.home} matches={p.matches} />
          <PlayerList team={away} players={p.away} matches={p.matches} />
        </div>
      )}
    </div>
  );
}

function PlayerList({ team, players, matches }: { team: { id: number; name: string }; players: H2HPlayerSummary[]; matches: number }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-secondary px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 truncate text-sm font-bold">
        <TeamLogo id={team.id} name={team.name} size={18} />
        {team.name}
      </div>
      {players.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">Öne çıkan yok</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {players.map((pl) => (
            <li key={pl.playerId} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <Link href={`/players/${pl.playerId}`} className="min-w-0 truncate font-semibold hover:text-primary">
                {pl.name}
              </Link>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {[pl.goals ? `${pl.goals} gol` : null, pl.assists ? `${pl.assists} asist` : null].filter(Boolean).join(" · ")}
                </span>
                <span className="text-xs"> · {matches} maçın {pl.games} tanesinde oynadı</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
