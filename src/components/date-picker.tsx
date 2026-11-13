"use client";
// Üst menüdeki tarih seçici: ‹ [📅 15 Ekim Perşembe] › — tıklayınca Türkçe takvim açılır.
// shadcn Calendar (react-day-picker) + Popover kullanır.
import { useState } from "react";
import { tr } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { shiftDate, todayTR } from "@/lib/dates";
import { cn } from "@/lib/utils";

// "2026-10-15" ↔ Date (yerel gece yarısı; takvim yerel tarihle çalışır)
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// short: mobil için kısa ay adı ("15 Eki")
function label(s: string, today: string, short = false) {
  const rel = s === today ? "Bugün" : s === shiftDate(today, -1) ? "Dün" : s === shiftDate(today, 1) ? "Yarın" : null;
  const text = toDate(s).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: short ? "short" : "long",
    weekday: rel ? undefined : "short",
  });
  return rel ? `${rel}, ${text}` : text;
}

export function DatePicker({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const today = todayTR();
  const isToday = date === today;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(shiftDate(date, -1))}
        aria-label="Önceki gün"
        className="rounded-full px-1.5 py-0.5 text-2xl font-bold text-white/80 sm:px-2.5 hover:bg-white/15 hover:text-white"
      >
        ‹
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-white bg-white px-3 py-1.5 text-sm font-bold text-foreground sm:min-w-44",
            "transition-transform hover:-rotate-1",
            isToday && "border-[var(--yellow)] bg-[var(--yellow)]",
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span className="sm:hidden">{label(date, today, true)}</span>
          <span className="hidden sm:inline">{label(date, today)}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <Calendar
            mode="single"
            locale={tr}
            weekStartsOn={1}
            selected={toDate(date)}
            defaultMonth={toDate(date)}
            onSelect={(d) => {
              if (!d) return;
              setOpen(false);
              onChange(toKey(d));
            }}
          />
          {!isToday && (
            <button
              onClick={() => {
                setOpen(false);
                onChange(today);
              }}
              className="mt-1 w-full rounded-md py-1.5 text-sm font-medium text-primary hover:bg-secondary"
            >
              Bugüne dön
            </button>
          )}
        </PopoverContent>
      </Popover>

      <button
        onClick={() => onChange(shiftDate(date, 1))}
        aria-label="Sonraki gün"
        className="rounded-full px-1.5 py-0.5 text-2xl font-bold text-white/80 sm:px-2.5 hover:bg-white/15 hover:text-white"
      >
        ›
      </button>
    </div>
  );
}
