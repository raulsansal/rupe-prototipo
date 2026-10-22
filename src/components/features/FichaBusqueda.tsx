import Image from "next/image";
import { Icono } from "@/components/ui/Icono";
import { Logo } from "@/components/ui/Logo";
import { cx } from "@/lib/clases";
import { formatearFechaLarga } from "@/lib/formato";
import { edadAproximada, etiquetaTamano } from "@/lib/perro";
import { DOMINIO_PUBLICO } from "@/mocks/parametros";
import type { FichaPublica } from "@/mocks/tipos";
import { QrIlustrativo } from "./QrIlustrativo";

export type TamanoHoja = "carta" | "media-carta";

/** 21.6 × 27.9 cm y 21.6 × 14 cm (lámina 4.11 y HU 027). */
const PAGINAS: Record<TamanoHoja, { size: string; aspecto: string }> = {
  carta: { size: "21.6cm 27.9cm", aspecto: "aspect-[21.6/27.9]" },
  "media-carta": { size: "21.6cm 14cm", aspecto: "aspect-[21.6/14]" },
};

type Props = {
  /** Solo campos públicos: la ficha de búsqueda nunca lleva datos de la persona tutora ni lo reservado. */
  ficha: FichaPublica;
  tamano?: TamanoHoja;
  /** Cambia el dibujo del QR ilustrativo (al regenerarlo). */
  versionQr?: number;
  /** Marca esta hoja como la que se imprime (CSS de impresión): solo debe haber una en la página. */
  paraImprimir?: boolean;
  className?: string;
};

/**
 * Hoja de la ficha de búsqueda (lámina 4.11), en Carta o Media carta. Siempre negro sobre blanco (en ambos modos de la
 * interfaz, por el `data-theme="light"` y los tokens papel/tinta). Los tamaños de texto son los de la lámina en puntos,
 * expresados en cqw (1 pt = 0.1634 cqw en una hoja de 21.6 cm) para que la vista previa escale igual que la hoja real.
 */
export function FichaBusqueda({ ficha, tamano = "carta", versionQr = 1, paraImprimir = false, className }: Props) {
  const carta = tamano === "carta";
  const { folio, nombre } = ficha;
  const datos = `${ficha.sexo} · ${edadAproximada(ficha)} · ${ficha.raza} · ${etiquetaTamano(ficha.tamano)} · ${ficha.color}`;
  const semilla = `${folio}-${versionQr}`;

  const lugar = (
    <div className="rounded-[1.4cqw] border-[0.35cqw] border-tinta px-[2.4cqw] py-[1.4cqw] text-[2.29cqw] leading-[1.35]">
      <p className="flex items-center gap-[1cqw]">
        <Icono nombre="calendar_month" className="size-[2.6cqw]" />
        <span>
          <strong className="font-bold">Se extravió el</strong> {formatearFechaLarga(ficha.fechaExtravio)}
        </span>
      </p>
      <p className="flex items-center gap-[1cqw]">
        <Icono nombre="location_on" className="size-[2.6cqw]" />
        <span>
          <strong className="font-bold">Lugar:</strong> col. {ficha.coloniaZona}, alcaldía {ficha.alcaldia}
        </span>
      </p>
    </div>
  );

  const encabezado = (ancho: string, etiqueta: string) => (
    <div className="flex items-center justify-between gap-[1cqw]">
      <Logo variante="horizontal" className={cx(ancho, "h-auto")} />
      <span className={cx(etiqueta, "font-bold uppercase tracking-[0.2em]")}>Ficha de búsqueda</span>
    </div>
  );

  return (
    <div className={cx("[container-type:inline-size] w-full", paraImprimir && "ficha-impresion", className)} data-theme="light">
      {paraImprimir && <style>{`@media print { @page { size: ${PAGINAS[tamano].size}; margin: 0; } }`}</style>}
      <article
        data-hoja={tamano}
        aria-label={`Ficha de búsqueda de ${nombre}, ${carta ? "tamaño Carta" : "tamaño Media carta"}`}
        className={cx("relative w-full overflow-hidden border border-border bg-papel p-[6.94cqw] font-sans text-tinta shadow-sm", PAGINAS[tamano].aspecto)}
      >
        {carta ? (
          // Carta: la fotografía ocupa todo el alto que dejan los demás elementos (≥ 40 % de la hoja, lámina 4.11).
          <div className="flex h-full flex-col gap-[0.9cqw]">
            {encabezado("w-[12cqw]!", "text-[1.4cqw]")}
            <h2 className="text-[4.58cqw] font-extrabold uppercase leading-none">¡Ayúdame a regresar a casa!</h2>
            <div data-foto-ficha className="relative min-h-0 flex-1 overflow-hidden rounded-[1cqw] border border-border bg-background">
              <Image src={ficha.fotografiaUrl} alt={`Fotografía de ${nombre}, sin recorte`} fill sizes="640px" className="object-contain" priority />
            </div>
            <div>
              <p className="flex flex-wrap items-baseline gap-x-[1.6cqw]">
                <strong className="text-[3.59cqw] font-bold uppercase leading-tight">{nombre}</strong>
                <span className="text-[2.29cqw] font-medium">{datos}</span>
              </p>
              {ficha.caracteristicasDistintivas && (
                <p className="mt-[0.3cqw] text-[2.29cqw] font-medium leading-[1.25]">
                  <strong className="font-bold">Características distintivas:</strong> {ficha.caracteristicasDistintivas}
                </p>
              )}
            </div>
            {lugar}
            <hr className="border-t-[0.35cqw] border-tinta" />
            <div className="flex items-center justify-between gap-[2cqw]">
              <div className="min-w-0">
                <p className="text-[2.29cqw] font-bold leading-tight">¿Lo viste? Escanea el código y cuéntanos dónde.</p>
                <p className="text-[1.47cqw] leading-tight">O entra a {DOMINIO_PUBLICO} y escribe el folio.</p>
                <p className="mt-[0.5cqw] text-[2.94cqw] font-extrabold leading-none tabular-nums">{folio}</p>
              </div>
              <QrIlustrativo semilla={semilla} className="size-[14cqw] shrink-0 rounded-[0.8cqw] border-[0.35cqw] border-tinta" />
            </div>
            <p className="text-[1.25cqw] leading-tight">Esta ficha no incluye datos de contacto de la persona tutora; los avisos llegan a ella a través del sistema. No sustituye ningún registro oficial.</p>
          </div>
        ) : (
          // Media carta: la fotografía ocupa todo el alto de la hoja a la izquierda; el resto va en la columna derecha.
          <div className="grid h-full grid-cols-[52cqw_minmax(0,1fr)] gap-[2.2cqw]">
            <div data-foto-ficha className="relative overflow-hidden rounded-[1cqw] border border-border bg-background">
              <Image src={ficha.fotografiaUrl} alt={`Fotografía de ${nombre}, sin recorte`} fill sizes="320px" className="object-contain" priority />
            </div>
            <div className="flex min-h-0 flex-col gap-[0.9cqw]">
              {encabezado("w-[11cqw]!", "text-[1cqw]")}
              <h2 className="text-[2.9cqw] font-extrabold uppercase leading-[1.05]">¡Ayúdame a regresar a casa!</h2>
              <div>
                <strong className="text-[2.5cqw] font-bold uppercase leading-tight">{nombre}</strong>
                <p className="text-[1.5cqw] font-medium leading-[1.25]">{datos}</p>
                {ficha.caracteristicasDistintivas && (
                  <p className="text-[1.5cqw] font-medium leading-[1.25]">
                    <strong className="font-bold">Características distintivas:</strong> {ficha.caracteristicasDistintivas}
                  </p>
                )}
              </div>
              <div className="rounded-[1.2cqw] border-[0.3cqw] border-tinta px-[1.5cqw] py-[0.7cqw] text-[1.5cqw] leading-[1.3]">
                <p>
                  <strong className="font-bold">Se extravió el</strong> {formatearFechaLarga(ficha.fechaExtravio)}
                </p>
                <p>
                  <strong className="font-bold">Lugar:</strong> col. {ficha.coloniaZona}, alcaldía {ficha.alcaldia}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-[1.4cqw] border-t-[0.3cqw] border-tinta pt-[0.8cqw]">
                <div className="min-w-0">
                  <p className="text-[1.5cqw] font-bold leading-tight">¿Lo viste? Escanea el código.</p>
                  <p className="text-[2.2cqw] font-extrabold leading-tight tabular-nums">{folio}</p>
                </div>
                <QrIlustrativo semilla={semilla} className="size-[14cqw] shrink-0 rounded-[0.6cqw] border-[0.3cqw] border-tinta" />
              </div>
              <p className="text-[1.05cqw] leading-tight">Esta ficha no incluye datos de contacto de la persona tutora; los avisos llegan a ella a través del sistema. No sustituye ningún registro oficial.</p>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
