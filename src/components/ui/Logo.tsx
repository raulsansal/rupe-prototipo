import Image from "next/image";

type Variante = "horizontal" | "cuadrado" | "simbolo";

/** Archivos en public/brand y dimensiones (viewBox) de cada familia. */
const FAMILIAS: Record<Variante, { prefijo: string; ancho: number; alto: number }> = {
  horizontal: { prefijo: "logo_hor", ancho: 1772, alto: 709 },
  cuadrado: { prefijo: "logo_cuadrado", ancho: 709, alto: 709 },
  simbolo: { prefijo: "perro_cuad", ancho: 591, alto: 532 },
};

type Props = {
  variante?: Variante;
  /** "blanco" fuerza la versión blanca para usarla sobre un fondo de color. */
  tono?: "blanco";
  /** Ancho en px; el alto se calcula con la proporción del logotipo. */
  ancho?: number;
  className?: string;
};

/**
 * Elige el color según el tema con CSS (sin JS): "primario" en claro, "oscuro" (menta) en oscuro.
 * Se renderizan las dos versiones y las clases logo-primario / logo-oscuro muestran la que toca.
 */
export function Logo({ variante = "horizontal", tono, ancho = 160, className }: Props) {
  const { prefijo, ancho: w, alto: h } = FAMILIAS[variante];
  const estilo = { width: ancho, height: "auto" } as const;
  // loading="eager": son SVG pequeños y de marca; con carga diferida podían no cargarse bajo el pliegue
  const dimensiones = { width: w, height: h, style: estilo, loading: "eager" } as const;

  if (tono === "blanco") {
    return <Image src={`/brand/${prefijo}_blanco.svg`} alt="RUPE" className={className} {...dimensiones} />;
  }
  return (
    <>
      <Image src={`/brand/${prefijo}_primario.svg`} alt="RUPE" className={`logo-primario ${className ?? ""}`.trim()} {...dimensiones} />
      <Image src={`/brand/${prefijo}_oscuro.svg`} alt="RUPE" className={`logo-oscuro ${className ?? ""}`.trim()} {...dimensiones} />
    </>
  );
}
