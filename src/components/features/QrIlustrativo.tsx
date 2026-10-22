import { cx } from "@/lib/clases";

const MODULOS = 25;

/** Matriz de módulos determinista a partir de un texto: tres cuadros de posición y relleno pseudoaleatorio. Solo ilustra: NO es un QR válido. */
function matriz(semilla: string): boolean[][] {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const siguiente = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
  const m = Array.from({ length: MODULOS }, () => Array.from({ length: MODULOS }, () => siguiente() > 0.52));
  const cuadro = (x0: number, y0: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const fx = x0 + x;
        const fy = y0 + y;
        if (fx < 0 || fy < 0 || fx >= MODULOS || fy >= MODULOS) continue;
        const borde = x === 0 || x === 6 || y === 0 || y === 6;
        const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[fy][fx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (borde || centro);
      }
    }
  };
  cuadro(0, 0);
  cuadro(MODULOS - 7, 0);
  cuadro(0, MODULOS - 7);
  return m;
}

type Props = {
  /** Texto que determina el dibujo (p. ej. el folio y la versión del código). */
  semilla: string;
  className?: string;
};

/**
 * Código QR ILUSTRATIVO (SVG estático, sin librería): siempre negro sobre blanco con zona de silencio, como pide la lámina 4.11.
 * No se puede escanear; en el Prototipo lo reemplazará un QR real que apunte a la ficha pública.
 */
export function QrIlustrativo({ semilla, className }: Props) {
  const m = matriz(semilla);
  const q = 4; // zona de silencio, en módulos
  const d = m.flatMap((fila, y) => fila.map((on, x) => (on ? `M${x + q} ${y + q}h1v1h-1z` : ""))).join("");
  return (
    <svg viewBox={`0 0 ${MODULOS + q * 2} ${MODULOS + q * 2}`} role="img" aria-label="Código QR ilustrativo (no se puede escanear)" className={cx("block bg-papel", className)} shapeRendering="crispEdges">
      <rect width="100%" height="100%" className="fill-papel" />
      <path d={d} className="fill-tinta" />
    </svg>
  );
}
