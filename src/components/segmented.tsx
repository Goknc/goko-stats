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
    <div className="flex w-fit flex-wrap rounded-lg bg-secondary p-1 text-sm">
      {options.map((o) => (
        <Link
          key={o.key}
          href={href(o.key)}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1 font-medium whitespace-nowrap transition-colors",
            value === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
