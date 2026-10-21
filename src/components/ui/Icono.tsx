import { RUTAS_ICONO, type NombreIcono } from "./iconos/rutas";

export type { NombreIcono };

type Props = {
  nombre: NombreIcono;
  /** Lado en px: 20 y 24 normalmente; 32 y 48 en estados vacíos. */
  tamano?: 20 | 24 | 32 | 48 | number;
  /** Si se da, el ícono se anuncia como imagen con ese texto; si no, es decorativo (aria-hidden). */
  titulo?: string;
  className?: string;
};

/** Material Symbols Rounded con relleno (FILL 1). Hereda el color del texto (currentColor). */
export function Icono({ nombre, tamano = 24, titulo, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={tamano}
      height={tamano}
      fill="currentColor"
      className={`shrink-0 ${className ?? ""}`.trim()}
      aria-hidden={titulo ? undefined : true}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      focusable="false"
    >
      {RUTAS_ICONO[nombre].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
