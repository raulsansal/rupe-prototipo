import { cx } from "@/lib/clases";

function Huella({ x, y, giro = 0 }: { x: number; y: number; giro?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`} className="fill-primary">
      <ellipse cx="0" cy="8" rx="11" ry="9" />
      <circle cx="-13" cy="-7" r="5" />
      <circle cx="-5" cy="-16" r="5" />
      <circle cx="5" cy="-16" r="5" />
      <circle cx="13" cy="-7" r="5" />
    </g>
  );
}

/** Imagen principal ilustrativa de la página de inicio (decorativa): colinas, sol, huellas y un marcador de mapa, solo con tokens. */
export function ImagenPrincipal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={cx("block w-full rounded-tarjeta", className)}>
      <rect width="800" height="300" className="fill-primary-soft" />
      <circle cx="640" cy="80" r="42" className="fill-accent" />
      <path d="M0 210 C120 150 240 150 360 195 C480 240 620 160 800 190 V300 H0 Z" className="fill-surface" />
      <path d="M0 255 C160 215 300 245 440 235 C580 225 700 245 800 232 V300 H0 Z" className="fill-border" />
      <Huella x={120} y={228} giro={-20} />
      <Huella x={200} y={252} giro={15} />
      <Huella x={285} y={232} giro={-15} />
      <g transform="translate(470 70)">
        <path d="M0 110 C-40 60 -48 40 -48 22 A48 48 0 1 1 48 22 C48 40 40 60 0 110 Z" className="fill-primary" />
        <circle cx="0" cy="22" r="18" className="fill-primary-soft" />
      </g>
    </svg>
  );
}
