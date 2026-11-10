// src/app/api/search/route.ts
// GET /api/search?q=arda&type=all|team|player → { teams, players }. Arama kutusunun otomatik tamamlaması kullanır.
import type { NextRequest } from "next/server";
import { MIN_QUERY, normalizeQuery, search, type SearchKind } from "@/lib/search";

const KINDS: SearchKind[] = ["all", "team", "player"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = normalizeQuery(params.get("q"));
  const type = params.get("type");
  const kind: SearchKind = KINDS.includes(type as SearchKind) ? (type as SearchKind) : "all";

  if (q.length < MIN_QUERY) return Response.json({ teams: [], players: [] });

  const result = await search(q, kind, 6);
  // Aynı sorgu kısa süre tarayıcı ve CDN önbelleğinde kalır (veri günde birkaç kez değişir)
  return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
