// Bölünmüş düğme: seçenekler bağlantıdır (filtre adres çubuğunda durur). Takım, oyuncu ve karşılaştırma sayfaları kullanır.
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  options, value, href,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  href: (key: T) => string;
}) {
  return (
    <div className="flex w-fit flex-wrap rounded-full border-2 border-foreground bg-white p-1 shadow-[3px_3px_0_var(--ink)] text-sm">
      {options.map((o) => (
        <Link
          key={o.key}
          href={href(o.key)}
          scroll={false}
          className={cn(
            "rounded-full px-3.5 py-1 font-bold whitespace-nowrap transition-colors",
            value === o.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
