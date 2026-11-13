// Maç detayı: form ayarı çubuğu (son 10/15/20 · takım ve oyuncu form türü).
// Seçimler adres çubuğuna yazılır (?n=20&team=all&player=venue) ve yalnızca bu sayfaya uygulanır.
import Link from "next/link";
import type { SampleMode, SampleSettings } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

export const SAMPLE_SIZE_OPTIONS = [10, 15, 20] as const;

interface SampleBarProps {
  value: SampleSettings; // bu sayfada kullanılan
  defaults: SampleSettings;
  hrefFor: (next: SampleSettings) => string;
}

export function Segment<T extends string | number>({
  label, options, current, href,
}: { label: string; options: { value: T; text: string }[]; current: T; href: (v: T) => string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="poster text-base">{label}</span>
      <div className="flex rounded-full border-2 border-foreground bg-white p-1 shadow-[3px_3px_0_var(--ink)]">
        {options.map((o) => (
          <Link
            key={o.value}
            href={href(o.value)}
            scroll={false}
            className={cn(
              "rounded-full px-3.5 py-1 font-bold transition-colors",
              current === o.value ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.text}
          </Link>
        ))}
      </div>
    </div>
  );
}

const MODES: { value: SampleMode; text: string }[] = [
  { value: "venue", text: "İç / Dış saha" },
  { value: "all", text: "Genel" },
];

export function SampleBar({ value, defaults, hrefFor }: SampleBarProps) {
  const custom = value.size !== defaults.size || value.teamMode !== defaults.teamMode || value.playerMode !== defaults.playerMode;
  const sizes = SAMPLE_SIZE_OPTIONS.map((n) => ({ value: n as number, text: `Son ${n}` }));
  if (!SAMPLE_SIZE_OPTIONS.includes(value.size as (typeof SAMPLE_SIZE_OPTIONS)[number])) sizes.push({ value: value.size, text: `Son ${value.size}` });

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl border-[2.5px] border-foreground bg-[var(--lilac)] px-4 py-3 shadow-[5px_5px_0_var(--ink)]">
      <Segment label="Form" options={sizes} current={value.size} href={(size) => hrefFor({ ...value, size })} />
      <Segment label="Takımlar" options={MODES} current={value.teamMode} href={(teamMode) => hrefFor({ ...value, teamMode })} />
      <Segment label="Oyuncular" options={MODES} current={value.playerMode} href={(playerMode) => hrefFor({ ...value, playerMode })} />
      <div className="ml-auto flex items-center gap-3 text-sm">
        {custom ? (
          <>
            <span className="rounded-full border-2 border-foreground bg-[var(--yellow)] px-2 py-0.5 text-xs font-bold">özel seçim</span>
            <Link href={hrefFor(defaults)} scroll={false} className="font-bold underline hover:text-primary">
              Sıfırla
            </Link>
          </>
        ) : (
          <span className="marker text-xl">varsayılan ayar</span>
        )}
      </div>
    </div>
  );
}
