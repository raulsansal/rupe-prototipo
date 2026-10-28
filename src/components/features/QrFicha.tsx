import { MODULOS_ZONA_DE_SILENCIO } from "@/lib/ficha/composicion";

type Props = {
  /** Filas de módulos del QR (true = oscuro). Viene del servidor (qrcode): solo lleva la URL pública de la ficha. */
  filas: boolean[][];
  /** Lado en puntos (pt) del cuadro COMPLETO: símbolo más la zona de silencio de 4 módulos. */
  ladoPt: number;
  etiqueta: string;
  className?: string;
};

/** QR real en vectores: negro sobre blanco con su zona de silencio, en ambos modos de la interfaz (un QR no se invierte). */
export function QrFicha({ filas, ladoPt, etiqueta, className }: Props) {
  const n = filas.length;
  const q = MODULOS_ZONA_DE_SILENCIO;
  const total = n + 2 * q;
  const trazos = filas
    .flatMap((fila, y) => {
      const corridas: string[] = [];
      let x = 0;
      while (x < fila.length) {
        if (!fila[x]) {
          x++;
          continue;
        }
        let k = x;
        while (k < fila.length && fila[k]) k++;
        corridas.push(`M${x + q} ${y + q}h${k - x}v1h-${k - x}z`);
        x = k;
      }
      return corridas;
    })
    .join("");
  return (
    <svg role="img" aria-label={etiqueta} viewBox={`0 0 ${total} ${total}`} width={`${ladoPt}pt`} height={`${ladoPt}pt`} shapeRendering="crispEdges" className={className} style={{ display: "block" }}>
      <rect width={total} height={total} className="fill-papel" />
      <path d={trazos} className="fill-tinta" />
    </svg>
  );
}
