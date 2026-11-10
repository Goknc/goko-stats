// Takım / lig logosu ve oyuncu fotoğrafı: BSD görsel adresinden doğrudan (token yok, kotaya sayılmaz, tarayıcı 1 yıl önbellekler).
// BSD görseli olmayan kimlikte 204 değil 1x1 boş PNG döndürüyor; yüklenince genişliğe bakılır, boşsa baş harfler gösterilir.
"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const BASE = "https://sports.bzzoiro.com/img";

type Kind = "team" | "league" | "player";

// Logolarda beyaz zemin silinir (karanlık temada beyaz kutu kalmasın); oyuncu fotoğrafı olduğu gibi
const srcOf = (kind: Kind, id: number) => `${BASE}/${kind}/${id}/${kind === "player" ? "" : "?bg=transparent"}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr"))
    .join("");

function EntityImage({ kind, id, name, size, className }: { kind: Kind; id: number; name: string; size: number; className?: string }) {
  const [missing, setMissing] = useState(false);
  const round = kind === "player";
  if (missing) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: size * 0.38 }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-secondary font-semibold text-muted-foreground",
          round ? "rounded-full" : "rounded-md",
          className,
        )}
      >
        {kind === "player" ? initials(name) : name[0]?.toLocaleUpperCase("tr")}
      </span>
    );
  }
  return (
    <Image
      src={srcOf(kind, id)}
      alt=""
      width={size}
      height={size}
      unoptimized
      onLoad={(e) => e.currentTarget.naturalWidth <= 1 && setMissing(true)}
      onError={() => setMissing(true)}
      className={cn("shrink-0", round ? "rounded-full bg-secondary object-cover" : "object-contain", className)}
    />
  );
}

export function TeamLogo(props: { id: number; name: string; size?: number; className?: string }) {
  return <EntityImage kind="team" size={20} {...props} />;
}

export function LeagueLogo(props: { id: number; name: string; size?: number; className?: string }) {
  return <EntityImage kind="league" size={20} {...props} />;
}

export function PlayerPhoto(props: { id: number; name: string; size?: number; className?: string }) {
  return <EntityImage kind="player" size={36} {...props} />;
}
