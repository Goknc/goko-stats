// src/app/search/page.tsx
// Arama sonuçları: /search?q=... — takımlar ve oyuncular ayrı listelerde.
import Link from "next/link";
import { MIN_QUERY, normalizeQuery, search } from "@/lib/search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { SearchBox } from "@/components/search-box";

export const dynamic = "force-dynamic";

const POSITIONS: Record<string, string> = { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" };

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = normalizeQuery((await searchParams).q);
  return { title: { absolute: q ? `"${q}" araması · Gokostats` : "Ara · Gokostats" } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = normalizeQuery((await searchParams).q);
  const { teams, players } = q.length >= MIN_QUERY ? await search(q, "all", 30) : { teams: [], players: [] };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-9 px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-2xl font-bold">Ara</h1>
      <SearchBox className="max-w-xl" autoFocus />

      {q.length < MIN_QUERY ? (
        <p className="text-muted-foreground">Takım veya oyuncu adından en az {MIN_QUERY} harf yaz.</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            &quot;{q}&quot; için {teams.length} takım, {players.length} oyuncu
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Takımlar</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {teams.length === 0 && <p className="px-6 pb-4 text-sm text-muted-foreground">Takım bulunamadı.</p>}
                {teams.map((t) => (
                  <Link key={t.id} href={`/teams/${t.id}`} className="flex items-center gap-3 px-6 py-2.5 hover:bg-muted/50">
                    <TeamLogo id={t.id} name={t.name} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.name}</span>
                      {t.league && <span className="block truncate text-xs text-muted-foreground">{t.league}</span>}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Oyuncular</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {players.length === 0 && <p className="px-6 pb-4 text-sm text-muted-foreground">Oyuncu bulunamadı.</p>}
                {players.map((p) => (
                  <Link key={p.id} href={`/players/${p.id}`} className="flex items-center gap-3 px-6 py-2.5 hover:bg-muted/50">
                    <PlayerPhoto id={p.id} name={p.name} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[p.team, p.position && POSITIONS[p.position]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
