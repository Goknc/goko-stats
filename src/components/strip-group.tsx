"use client";
// Şerit grubu: içindeki maç şeritleri ([data-strip]) birlikte kayar. Birini kaydırınca diğerleri aynı konuma gelir;
// böylece iki takımın aynı sıradaki maçları alt alta kalır.
import { useEffect, useRef } from "react";

export function StripGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // scroll olayı yukarı taşmaz; yakalama (capture) aşamasında dinlenir
    const onScroll = (e: Event) => {
      const source = e.target;
      if (!(source instanceof HTMLElement) || !source.hasAttribute("data-strip")) return;
      for (const el of root.querySelectorAll<HTMLElement>("[data-strip]")) {
        if (el !== source && el.scrollLeft !== source.scrollLeft) el.scrollLeft = source.scrollLeft;
      }
    };
    root.addEventListener("scroll", onScroll, true);
    return () => root.removeEventListener("scroll", onScroll, true);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
