// Arama kutusu: yazarken takım ve oyuncu önerileri (/api/search). Ok tuşları ve Enter ile seçilir, Esc kapatır.
// Seçim varsayılan olarak takım / oyuncu sayfasını açar. pickParam verilirse (karşılaştırma sayfası) yalnızca takımlar
// listelenir ve seçilen takım mevcut adresin o parametresine yazılır (?a=12).
// Öneri seçmeden Enter: /search?q=... sayfası.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PlayerHit, TeamHit } from "@/lib/search";
import { PlayerPhoto, TeamLogo } from "@/components/entity-image";
import { cn } from "@/lib/utils";

type Hit = TeamHit | PlayerHit;

interface SearchBoxProps {
  placeholder?: string;
  pickParam?: string;
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void; // seçimden sonra (mobil menüyü kapatmak için)
}

const POSITIONS: Record<string, string> = { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" };

export function SearchBox({ placeholder = "Takım veya oyuncu ara", pickParam, className, autoFocus, onNavigate }: SearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Yazmayı 200 ms bekleyip arar; önceki istek iptal edilir
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return; // kısa sorguda liste zaten gizli
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const type = pickParam ? "team" : "all";
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`, { signal: ctrl.signal });
        const data: { teams: TeamHit[]; players: PlayerHit[] } = await res.json();
        setHits([...data.teams, ...data.players]);
        setActive(-1);
        setOpen(true);
      } catch {
        // iptal edilen istek
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, pickParam]);

  // Dışarı tıklayınca kapanır
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (hit: Hit) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    if (pickParam) {
      const next = new URLSearchParams(params.toString());
      next.set(pickParam, String(hit.id));
      router.push(`${pathname}?${next.toString()}`);
      return;
    }
    router.push(hit.type === "team" ? `/teams/${hit.id}` : `/players/${hit.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && hits[active]) go(hits[active]);
      else if (!pickParam && q.trim().length >= 2) {
        setOpen(false);
        onNavigate?.();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }
    }
  };

  const showList = open && q.trim().length >= 2;
  const teamCount = hits.filter((h) => h.type === "team").length;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <svg
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={placeholder}
        className="h-10 w-full rounded-full border-2 border-foreground bg-white pr-3 pl-9 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--pink)]"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-96 min-w-64 overflow-y-auto rounded-2xl border-2 border-foreground bg-popover p-1 text-foreground shadow-[5px_5px_0_var(--purple)]"
        >
          {hits.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{loading ? "Aranıyor…" : "Sonuç yok"}</li>
          )}
          {hits.map((h, i) => (
            <li key={`${h.type}-${h.id}`}>
              {(i === 0 || i === teamCount) && !pickParam && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {h.type === "team" ? "Takımlar" : "Oyuncular"}
                </div>
              )}
              <button
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                  i === active ? "bg-secondary text-foreground" : "text-foreground/90",
                )}
              >
                {h.type === "team" ? <TeamLogo id={h.id} name={h.name} size={22} /> : <PlayerPhoto id={h.id} name={h.name} size={26} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {h.type === "team" ? h.league ?? "Takım" : [h.team, h.position && POSITIONS[h.position]].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
