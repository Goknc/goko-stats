// Logonun arkasında dönen çizgi film alevi (maç posterinde takımın üstüne gelince görünür).
// İki halka: dışta turuncu, içte sarı diller; kalın mürekkep çerçeve. Diller kare kare (steps) titrer ki elle çizilmiş gibi dursun.
// Görünürlük ve animasyon globals.css > .flame-ring; kapsayan öğede `group` sınıfı olmalı.

// Tek alev dili: tabanı (0,0) çevresinde, ucu yukarı (-y) bakar ve hafifçe kıvrılır
const TONGUE = "M-11 3Q-16-13-5-22Q-7-12 0-13Q7-22 2-40Q18-22 11 3Z";

function Ring({ count, radius, scale, offset, fill }: { count: number; radius: number; scale: number; offset: number; fill: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i + offset;
        // Uzun ve kısa diller sırayla; hepsi dönüş yönüne doğru yatık (savrulan alev)
        const size = scale * (i % 2 ? 0.72 : 1);
        return (
          <g key={i} transform={`rotate(${angle}) translate(0 ${-radius}) rotate(32) scale(${size})`}>
            <path
              d={TONGUE}
              fill={fill}
              stroke="var(--ink)"
              strokeWidth={3 / size}
              strokeLinejoin="round"
              className="flame-tongue"
              style={{ animationDelay: `${-(i % 4) * 0.23}s` }}
            />
          </g>
        );
      })}
    </>
  );
}

export function FlameRing({ className }: { className?: string }) {
  return (
    <svg viewBox="-100 -100 200 200" className={`flame-ring pointer-events-none ${className ?? ""}`} aria-hidden="true">
      <g className="flame-spin">
        <Ring count={10} radius={56} scale={1.35} offset={0} fill="#ff7a1a" />
      </g>
      <g className="flame-spin flame-spin-rev">
        <Ring count={10} radius={54} scale={0.85} offset={18} fill="var(--yellow)" />
      </g>
    </svg>
  );
}
