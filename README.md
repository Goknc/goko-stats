# Gokostats

**English** · [Türkçe](README.tr.md)

A football statistics web app: team and player trends, form leaderboards, head-to-head records, side-by-side team comparison and match analysis for 90+ competitions (leagues, domestic cups, continental and national-team tournaments), all built from recent match history.

<!-- Screenshots: put images in docs/screenshots/ and uncomment
![Player page](docs/screenshots/player.png)
![Compare](docs/screenshots/compare.png)
![Match detail](docs/screenshots/match.png)
-->

## Features

- **Daily match list**: tracked leagues sorted by popularity, with a date picker.
- **Match detail**: scoreboard, full-time and half-by-half match stats, standout trends, a score prediction model, head-to-head card (all / home / away, last 5/10/20/all), team trend cards with a match-by-match breakdown, line-ups drawn on a pitch (confirmed XI, else predicted XI, else the previous match's XI, labelled accordingly, plus bench and pre-match injuries/suspensions), a player threshold board, and player cards for both line-ups. Sample size, form type and the highlight threshold can be changed on the page.
- **Player threshold board** (match detail): pick a stat (shots, shots on target, tackles, fouls, key passes…), last 5/10/15 matches and a threshold; every player's recent matches appear as squares, green when the threshold was reached and red when not. Filters: home/away, national-team matches only, starts only.
- **Trends**: every match of the day where both teams' recent record clears a threshold (e.g. *both teams scored in 14 of the last 20*, *10+ corners*, *player 3+ shots*). You can filter by trend and sort by rate, kick-off or match.
- **Team page**: goals, corners, shots, cards and fouls over the last 5/10/20 matches, filterable by venue, competition and half, as a list or a bar chart with an adjustable threshold. Also a player grid for the squad.
- **Player page**: profile, running streaks (*scored in 5 straight*), season summary (totals, per match, per 90, average rating), standout traits with the per-match value, opponent and minutes, detailed stats (passes, key passes, duels, aerials, dribbles, offsides, xG/xA, saves…), a match-by-match chart for any stat, and a full match log.
- **Search**: autocomplete for teams and players in the header (keyboard accessible), plus a results page.
- **Compare**: pick any two teams to see form, per-match averages, match-trend rates and head-to-head.
- **Leaderboards**: current-season leaders in ~30 categories (goals, assists, shots, xG, key passes, passes, duels, aerials, tackles, interceptions, offsides, cards, saves, rating…), ranked by total, per match or per 90 (with a minimum-matches rule), across all leagues or for one league.
- Responsive (mobile / tablet / desktop), dark theme.

## How it works

```
BSD API ──► sync scripts ──► PostgreSQL (Prisma) ──► analysis engine ──► Next.js pages
            (GitHub Actions cron)                    (pure functions,      (server components)
                                                      unit tested)
```

- **Sample rule:** a team's last N matches (default 20) in the same competition type within the last two seasons, either all venues or home/away only. Players use their last N **starts** (from the line-up, or 60+ minutes when the line-up is unknown).
- **Trend highlight:** a trend stands out when the hit rate clears its threshold for the deciding record(s). Within a ladder (e.g. 10+ / 11+ / 12+ corners) only the highest passing line is shown. Definitions live in [`src/lib/trend-config.ts`](src/lib/trend-config.ts).
- **Card counting:** yellow = 1, red = 2. A second-yellow dismissal counts as 3 in total.
- **Line-ups:** confirmed XI when announced; otherwise the data provider's predicted XI, cleaned of injured/suspended players, players who left the club and, for national teams, players not in the current call-up (squads of the same international window), with the gaps filled by the most regular starters; otherwise the previous match's XI or our own estimate.
- **Score prediction:** a Poisson regression trained on about 25k matches (Elo gap, opponent-adjusted goals, recent form, rest days, head-to-head) with a Dixon–Coles correction. It falls back to a classic opponent-adjusted Poisson model when there isn't enough data.

## Tech stack

Next.js 16 (App Router, server components) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · Prisma 7 · PostgreSQL · Vitest · Playwright · GitHub Actions · Vercel

Data source: [Bzzoiro Sports Data](https://sports.bzzoiro.com) API.

## Project structure

```
src/app/            pages (matches, trends, kings, teams/[id], players/[id], compare, search) and /api/search
src/components/     UI components (charts, cards, search box…)
src/lib/engine/     pure analysis functions + unit tests (no DB access)
src/lib/            data loaders (Prisma) that feed the engine
scripts/            BSD sync jobs and the score-model training script
prisma/             schema, migrations, league seed
e2e/                Playwright end-to-end tests
```

## Getting started

Requirements: Node.js 20+, PostgreSQL, a BSD API token.

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and BSD_API_TOKEN
npx prisma migrate deploy
npm run db:seed               # tracked leagues
npm run sync:daily            # seasons, matches, match/player stats, lineups
npm run dev                   # http://localhost:3000
```

### Data sync

| Command | What it does |
|---|---|
| `npm run sync:daily` | Seasons → matches → match & player stats → line-ups for the next 48 h |
| `npm run sync:lineups` | Line-ups and injury/suspension lists for matches starting in the next 3 h; runs hourly |
| `npm run sync:players` | Player profiles (age, height, market value, contract, injuries) for every tracked squad + careers/transfers of the 800 most-played players not refreshed in 30 days; runs weekly |
| `npm run sync:careers` | Careers and transfer history of the 1200 most-played players not yet synced; runs daily until the backlog is cleared |
| `npm run sync:player-extras -- --limit 300 [--all] [--dry]` | One-off backfill of detailed player stats for older matches (1 request per match) |

In production these run on a schedule from [`.github/workflows/sync.yml`](.github/workflows/sync.yml).

## Deployment (Vercel + hosted Postgres)

1. Create a Postgres database (e.g. Neon or Supabase free tier). The full dataset is about 100 MB.
2. Run the migrations against it: `DATABASE_URL=... npx prisma migrate deploy`, then `npm run db:seed`.
3. Load data, either with `npm run sync:daily` or by copying an existing local database (`pg_dump --data-only` → `psql`).
4. Import the repo in Vercel and set `DATABASE_URL` (use the pooled connection string).
5. In GitHub, add the repository secrets `DATABASE_URL` and `BSD_API_TOKEN` so the scheduled sync keeps the data fresh.

## Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Analysis engine: sample selection, hit rates, ladders, card totals, Poisson model, ratings, H2H, player profile, matchup |
| End-to-end | Playwright | Navigation, date picker, search, match / team / player pages, compare, filters and sorting, leaderboards, empty states, 404, no horizontal overflow, on desktop and mobile |
| CI | GitHub Actions | Lint, type check and unit tests on every push |

```bash
npm run lint
npx vitest run
npm run test:e2e        # builds the app and runs Playwright against the production build
```

## How this was built

Gokostats was developed with support from Claude, an AI coding assistant. I defined the requirements and statistics rules, chose the data source, made the design decisions and tested the app; Claude helped with the implementation.

## Disclaimer

Gokostats is an independent, non-commercial project built out of interest in football data. All data is fetched automatically through the Bzzoiro Sports Data API and refreshed daily; accuracy is not guaranteed. Statistics are based on past matches and are for informational purposes only. Nothing on this site is betting advice or encourages gambling; the site contains no betting links, ads or odds. Team logos, player photos and competition names belong to their respective owners; Gokostats is not affiliated with any club, league, federation or data provider.

## License

[MIT](LICENSE)
