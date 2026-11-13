"use client";
// Açılır seçim menüsü (Öneriler'de trend, Krallık'ta kategori). Seçenekler bağlantıdır; seçince sayfa o filtreyle açılır.
// Görünüm: "Trend  3+ gol  4 ▾" düğmesi → gruplu liste, seçilinin yanında ✓, sağda sayı rozeti.
import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  href: string;
}
export interface FilterGroup {
  title?: string;
  options: FilterOption[];
}

export function FilterSelect({ label, groups, selected }: { label: string; groups: FilterGroup[]; selected: string }) {
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.options).find((o) => o.value === selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "pop group flex items-center gap-2.5 rounded-full bg-card py-1.5 pl-4 pr-2.5 text-sm",
          "data-[state=open]:bg-[var(--yellow)]",
        )}
      >
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{current?.label ?? "Seç"}</span>
        {current?.count !== undefined && (
          <span className="rounded-md bg-primary/15 px-1.5 text-xs font-bold tabular-nums text-primary">{current.count}</span>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </PopoverTrigger>

      <PopoverContent align="start" className="max-h-[60vh] w-64 overflow-y-auto p-1.5">
        {groups.map((g, gi) => (
          <div key={g.title ?? gi} className={cn(gi > 0 && "mt-1.5 border-t border-border pt-1.5")}>
            {g.title && (
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {g.title}
              </div>
            )}
            {g.options.map((o) => {
              const active = o.value === selected;
              return (
                <Link
                  key={o.value}
                  href={o.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active ? "bg-primary/10 font-semibold text-foreground" : "text-foreground/90 hover:bg-secondary",
                  )}
                >
                  <span className={cn("w-4 text-primary", !active && "invisible")}>✓</span>
                  <span className="flex-1">{o.label}</span>
                  {o.count !== undefined && (
                    <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
