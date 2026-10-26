import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { PORTADA_ALT, PORTADA_ALTO, PORTADA_ANCHO, PORTADA_ARCHIVOS, PORTADA_OBJECT_POSITION, PORTADA_SIZES } from "@/config/portada";
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

// Al terminar de analizar las dos imágenes (este script va justo después), la del tema ACTIVO pasa a loading="eager" y fetchpriority="high"; la otra queda con
// loading="lazy" y display:none, así que no se descarga hasta que se cambia de tema. Va como CADENA HTML (nunca un elemento <script> de React: en el cliente React 19 avisaría
// «Encountered a script tag while rendering React component»). El tema ya lo fijó el script de lib/tema.ts al inicio del body.
const SCRIPT_CARGA_PORTADA = `(function(){var t=document.documentElement.getAttribute("data-theme")==="dark"?"oscuro":"claro";var i=document.querySelector('img[data-portada="'+t+'"]');if(i){i.setAttribute("fetchpriority","high");i.setAttribute("loading","eager")}})()`;

const existe = (ruta: string) => existsSync(join(process.cwd(), "public", ruta));

/**
 * Portada de la página de inicio: una sola composición responsive (16:9 en móvil, 21:8 en escritorio, que da `className`) con una versión para cada tema. Si falta alguno de los
 * dos archivos de public/portada/, se conserva la ilustración SVG. Sin texto encima. Valores en src/config/portada.ts.
 */
export function ImagenPrincipal({ className }: { className?: string }) {
  if (!existe(PORTADA_ARCHIVOS.claro) || !existe(PORTADA_ARCHIVOS.oscuro)) return <ImagenIlustrativa className={className} />;
  return (
    <div className={cx("relative w-full overflow-hidden rounded-tarjeta", className)}>
      {(["claro", "oscuro"] as const).map((tema) => (
        <Image
          key={tema}
          src={PORTADA_ARCHIVOS[tema]}
          alt={PORTADA_ALT}
          width={PORTADA_ANCHO}
          height={PORTADA_ALTO}
          sizes={PORTADA_SIZES}
          loading="lazy"
          data-portada={tema}
          suppressHydrationWarning
          className={cx(tema === "claro" ? "portada-claro" : "portada-oscuro", "absolute inset-0 h-full w-full object-cover")}
          style={{ objectPosition: PORTADA_OBJECT_POSITION }}
        />
      ))}
      <div hidden suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `<script>${SCRIPT_CARGA_PORTADA}</script>` }} />
    </div>
  );
}

/** Imagen ilustrativa de respaldo (decorativa): colinas, sol, huellas y un marcador de mapa, solo con tokens. */
function ImagenIlustrativa({ className }: { className?: string }) {
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
