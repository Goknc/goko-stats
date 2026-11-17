// src/lib/bsd/client.ts
// BSD API'ye erişen tek modül (adapter). Diğer kod BSD'yi yalnızca buradan görür.
import type {
  BsdPage, BsdLeague, BsdSeason, BsdEvent, BsdEventStats, BsdPlayerStats, BsdLineups,
  BsdPlayerProfile, BsdCareerSeason, BsdTransfer,
} from "./types";

const BASE_URL = "https://sports.bzzoiro.com/api/v2";
const MAX_ATTEMPTS = 4;
// Geçici hatalarda (ağ yok, DNS, 5xx) denemeler arası bekleme: 5 sn, 15 sn, 45 sn
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

let requestCount = 0;
export const getRequestCount = () => requestCount;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Günlük kota bittiğinde fırlatılır; senkron görevleri bunu görünce tamamen durur
export class BsdQuotaError extends Error {}

type Params = Record<string, string | number | undefined>;

async function bsdFetch<T>(pathOrUrl: string, params?: Params): Promise<T> {
  const token = process.env.BSD_API_TOKEN;
  if (!token) throw new Error("BSD_API_TOKEN tanımlı değil (.env dosyasını kontrol et)");

  const url = pathOrUrl.startsWith("http") ? new URL(pathOrUrl) : new URL(BASE_URL + pathOrUrl);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const retryDelay = RETRY_DELAYS_MS[attempt - 1];
    requestCount++;

    // Ağ hatası (bilgisayar uykudan yeni uyandı, DNS çözülemedi, bağlantı koptu): bekleyip tekrar dene
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    } catch (e) {
      const cause = (e as { cause?: { code?: string } }).cause?.code;
      lastError = `ağ hatası${cause ? ` (${cause})` : ""}`;
      if (retryDelay === undefined) break;
      console.warn(`BSD ${lastError}: ${url.pathname} · ${retryDelay / 1000} sn sonra tekrar (${attempt}/${MAX_ATTEMPTS})`);
      await sleep(retryDelay);
      continue;
    }

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      if (body.code === "taster_exhausted") {
        throw new BsdQuotaError("BSD günlük kotası doldu, gece yarısı (UTC) sıfırlanır");
      }
      const waitSeconds = Number(res.headers.get("Retry-After") ?? 1);
      lastError = "429 çok fazla istek";
      await sleep(waitSeconds * 1000);
      continue;
    }

    // Sunucu tarafı geçici hata (502, 503, 504...): bekleyip tekrar dene
    if (res.status >= 500) {
      await res.body?.cancel().catch(() => {});
      lastError = `${res.status} sunucu hatası`;
      if (retryDelay === undefined) break;
      console.warn(`BSD ${lastError}: ${url.pathname} · ${retryDelay / 1000} sn sonra tekrar (${attempt}/${MAX_ATTEMPTS})`);
      await sleep(retryDelay);
      continue;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`BSD ${res.status} hatası: ${url.pathname}${url.search} → ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  throw new Error(`BSD isteği ${MAX_ATTEMPTS} denemede başarısız (${lastError}): ${url.pathname}`);
}

// Tüm sayfaları gezer. Bitişi `next === null` ile anlar, `count` ile değil (count güvenilmez).
async function fetchAllPages<T>(path: string, params?: Params): Promise<T[]> {
  const results: T[] = [];
  let page = await bsdFetch<BsdPage<T>>(path, { ...params, limit: 200 });
  results.push(...page.results);
  while (page.next) {
    page = await bsdFetch<BsdPage<T>>(page.next);
    results.push(...page.results);
  }
  return results;
}

export interface EventFilter {
  league_id?: number;
  season_id?: number;
  team_id?: number;
  status?: "upcoming" | "live" | "finished" | "cancelled" | "postponed";
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
}

export const bsd = {
  leagues: () => fetchAllPages<BsdLeague>("/leagues/"),
  leagueSeasons: async (leagueId: number) => {
    // Yanıt formatı belgelenmemiş: düz liste, { results: [...] } veya { seasons: [...] } olabilir.
    // İçindeki ilk diziyi sezon listesi olarak alıyoruz.
    const data = await bsdFetch<unknown>(`/leagues/${leagueId}/seasons/`);
    if (Array.isArray(data)) return data as BsdSeason[];
    const list = Object.values(data as Record<string, unknown>).find(Array.isArray);
    if (!list) {
      throw new Error(`Beklenmeyen sezon yanıtı, alanlar: ${Object.keys(data as object).join(", ")}`);
    }
    return list as BsdSeason[];
  },
  events: (filter: EventFilter) => fetchAllPages<BsdEvent>("/events/", { ...filter }),
  eventStats: (eventId: number) => bsdFetch<BsdEventStats>(`/events/${eventId}/stats/`),
  eventPlayerStats: (eventId: number) => bsdFetch<BsdPlayerStats>(`/events/${eventId}/player-stats/`),
  eventLineups: (eventId: number) => bsdFetch<BsdLineups>(`/events/${eventId}/lineups/`),
  // Takımın kadrosu, profil bilgileriyle (yaş, boy, piyasa değeri, sakatlık...)
  teamPlayers: (teamId: number) => fetchAllPages<BsdPlayerProfile>("/players/", { team_id: teamId }),
  playerCareer: (playerId: number) => bsdFetch<{ player_id: number; seasons: BsdCareerSeason[] }>(`/players/${playerId}/career/`),
  playerTransfers: (playerId: number) => bsdFetch<{ player_id: number; transfers: BsdTransfer[] }>(`/players/${playerId}/transfers/`),
};
