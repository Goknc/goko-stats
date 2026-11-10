// Süren seriler: "5 maçtır gol atıyor" rozetleri. 5+ maçlık seriler daha belirgin; kuraklık (gol atamıyor) soluk.
import { Flame, Snowflake } from "lucide-react";
import type { Streak } from "@/lib/engine/streaks";
import { cn } from "@/lib/utils";

export function StreakBadges({ streaks, className, size = "md" }: { streaks: Streak[]; className?: string; size?: "sm" | "md" }) {
  if (streaks.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {streaks.map((s) => {
        const cold = s.dir === "under";
        const hot = !cold && s.length >= 5;
        const Icon = cold ? Snowflake : Flame;
        return (
          <span
            key={s.group}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-semibold",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              cold
                ? "border-border bg-secondary text-muted-foreground"
                : hot
                  ? "border-hit/60 bg-hit/15 text-hit"
                  : "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true" />
            {s.text}
          </span>
        );
      })}
    </div>
  );
}
