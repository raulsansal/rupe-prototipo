import Image from "next/image";
import { Icono } from "@/components/ui/Icono";
import { Logo } from "@/components/ui/Logo";
import { altDeFoto } from "@/lib/altDeFoto";
import { cx } from "@/lib/clases";
import { bloquesDeFicha } from "@/lib/ficha/aHoja";
import { GEOMETRIA_CARTA as C, MODULOS_ZONA_DE_SILENCIO, PAGINA_PT, PT_POR_CM, QR_SIMBOLO_CM, TIPOGRAFIA, geometriaDeHoja, type Bloque, type BloqueId, type TamanoHoja } from "@/lib/ficha/composicion";
import { MENSAJE_FALTA_URL } from "@/server/config/mensajes";
import type { FichaPublica } from "@/mocks/tipos";
import { QrFicha } from "./QrFicha";

export type { TamanoHoja };

// Topes de línea: un texto largo se corta con elipsis (y una palabra sin espacios se parte) en vez de empujar la fotografía, el lugar, el QR o el folio fuera de la hoja.
// El texto completo de las características se lee en el detalle del caso. Los topes y las medidas salen de lib/ficha/composicion.ts: los mismos del PDF.
const tope = (n: number) => ({ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: n, overflow: "hidden", overflowWrap: "anywhere" }) as const;

type Props = {
  /** Solo campos públicos: la ficha de búsqueda nunca lleva datos de la persona tutora ni lo reservado. */
  ficha: FichaPublica;
  tamano?: TamanoHoja;
  /** Matriz del QR con el token vigente (calculada en el servidor). Sin ella (falta RUPE_URL_PUBLICA) la zona del QR avisa. */
  qr: { filas: boolean[][] } | null;
  /** Dominio de consulta que se imprime en el pie (host de la URL pública). */
  dominio: string;
  /** Marca esta hoja como la que se imprime (CSS de impresión): solo debe haber una en la página. */
  paraImprimir?: boolean;
  className?: string;
};

const est = (t: TamanoHoja, id: keyof (typeof TIPOGRAFIA)["carta"]) => ({ fontSize: `${TIPOGRAFIA[t][id].tam}pt`, lineHeight: TIPOGRAFIA[t][id].interlinea });

/**
 * Hoja de la ficha de búsqueda (lámina 4.11), en Carta (612×792 pt) o Media carta horizontal (612×396 pt). Siempre negro sobre blanco (en ambos modos de la interfaz, por el
 * `data-theme="light"` y los tokens papel/tinta). Todo se mide en puntos y se reduce con EscalaHoja; la zona de la fotografía es ≥ 40 % de la hoja POR CONSTRUCCIÓN (Carta ≥ 45,8 %,
 * Media carta 40,8 %): todo texto tiene tope de líneas, así que la banda de texto y QR tiene una altura máxima fija.
 */
export function FichaBusqueda({ ficha, tamano = "carta", qr, dominio, paraImprimir = false, className }: Props) {
  const carta = tamano === "carta";
  const pagina = PAGINA_PT[tamano];
  const g = geometriaDeHoja(tamano);
  const bloques = bloquesDeFicha(ficha, dominio, tamano);
  const b = (id: BloqueId) => bloques.find((x) => x.id === id) as Bloque;
  const caracteristicas = bloques.find((x) => x.id === "caracteristicas");
  const simbolo = QR_SIMBOLO_CM[tamano] * PT_POR_CM;
  const modulos = qr?.filas.length ?? 37;
  const lado = simbolo * ((modulos + 2 * MODULOS_ZONA_DE_SILENCIO) / modulos);

  const codigo = qr ? (
    <QrFicha filas={qr.filas} ladoPt={lado} etiqueta={`Código QR de la ficha ${ficha.folio}`} />
  ) : (
    <div role="note" className="flex items-center justify-center border border-tinta p-[4pt] text-center font-semibold" style={{ width: `${lado}pt`, height: `${lado}pt`, fontSize: `${carta ? 9 : 7}pt`, lineHeight: 1.2 }}>
      {MENSAJE_FALTA_URL}
    </div>
  );

  const foto = (
    <div data-foto-ficha className="relative h-full w-full overflow-hidden border border-border bg-background" style={{ borderRadius: "5pt" }}>
      <Image src={ficha.fotografiaUrl} alt={`${altDeFoto(ficha)}, sin recorte`} unoptimized={ficha.fotografiaUrl.startsWith("/api/")} fill sizes={carta ? "640px" : "320px"} className="object-contain" priority />
    </div>
  );

  const rotulado = (bl: Bloque) => (
    <>
      {bl.rotulo && <strong className="font-bold">{bl.rotulo}</strong>} {bl.texto}
    </>
  );
  const textos = (
    <div className="flex min-w-0 flex-col" style={{ gap: carta ? "4pt" : "3pt" }}>
      <div>
        <div className="font-bold uppercase" style={{ ...est(tamano, "nombre"), ...tope(b("nombre").maxLineas) }}>
          {b("nombre").texto}
        </div>
        <div className="font-medium" style={{ ...est(tamano, "datos"), ...tope(b("datos").maxLineas) }}>
          {b("datos").texto}
        </div>
        {caracteristicas && (
          <div className="font-medium" style={{ ...est(tamano, "caracteristicas"), ...tope(caracteristicas.maxLineas) }}>
            {rotulado(caracteristicas)}
          </div>
        )}
      </div>
      <div className="border-tinta" style={{ ...est(tamano, "fechaLugar"), borderWidth: carta ? "1pt" : "0.9pt", borderStyle: "solid", borderRadius: carta ? "8pt" : "4pt", padding: carta ? "3pt 8pt" : "2pt 5pt" }}>
        <p className="flex items-center gap-[4pt]">
          <Icono nombre="calendar_month" className={cx("shrink-0", carta ? "size-[11pt]" : "size-[8pt]")} />
          <span>{rotulado(b("fecha"))}</span>
        </p>
        <p className="flex items-center gap-[4pt]">
          <Icono nombre="location_on" className={cx("shrink-0", carta ? "size-[11pt]" : "size-[8pt]")} />
          <span style={tope(b("lugar").maxLineas)}>{rotulado(b("lugar"))}</span>
        </p>
      </div>
    </div>
  );

  const encabezado = (
    <div className="flex items-center justify-between" style={{ height: carta ? `${C.encabezado}pt` : "13pt" }}>
      <Logo variante="horizontal" ancho={Math.round((carta ? 20 : 13) * (1772 / 709) * (96 / 72))} />
      <span className="font-bold uppercase" style={est(tamano, "etiqueta")}>
        {b("encabezado").texto}
      </span>
    </div>
  );

  return (
    <div className={cx("w-full", paraImprimir && "ficha-impresion", className)} data-theme="light">
      {paraImprimir && <style>{`@media print { @page { size: ${pagina.ancho}pt ${pagina.alto}pt; margin: 0; } }`}</style>}
      <article
        data-hoja={tamano}
        aria-label={`Ficha de búsqueda de ${ficha.nombre}, ${carta ? "tamaño Carta" : "tamaño Media carta"}`}
        className="relative overflow-hidden bg-papel font-sans text-tinta shadow-sm ring-1 ring-border"
        style={{ width: `${pagina.ancho}pt`, height: `${pagina.alto}pt`, padding: "42.5pt" }}
      >
        {carta ? (
          <div className="flex h-full flex-col" style={{ gap: `${C.separacion}pt` }}>
            {encabezado}
            <h2 className="font-extrabold uppercase" style={{ ...est(tamano, "titulo"), height: `${C.titulo}pt`, whiteSpace: "nowrap" }}>
              {b("titulo").texto}
            </h2>
            <div className="min-h-0 flex-1" style={{ minHeight: `${g.foto.alto}pt` }}>
              {foto}
            </div>
            <div className="flex items-start overflow-hidden" data-banda style={{ gap: "12pt", maxHeight: `${C.bandaMaxima}pt` }}>
              <div className="min-w-0 flex-1">{textos}</div>
              <div className="flex flex-col items-center" style={{ width: `${C.columnaQr}pt`, gap: "4pt" }}>
                <p className="text-center font-bold" style={{ ...est(tamano, "indicacion") }}>
                  {b("indicacion").texto}
                </p>
                {codigo}
                <p className="whitespace-nowrap font-extrabold tabular-nums" style={est(tamano, "folio")}>
                  {ficha.folio}
                </p>
              </div>
            </div>
            <p className="overflow-hidden" style={{ ...est(tamano, "pie"), height: `${C.pie}pt` }}>
              {b("pie").texto}
            </p>
          </div>
        ) : (
          <div className="grid h-full" style={{ gridTemplateColumns: `${g.foto.ancho}pt minmax(0, 1fr)`, gap: "13.5pt" }}>
            <div data-foto-zona>{foto}</div>
            <div className="flex min-h-0 min-w-0 flex-col" style={{ gap: "3pt" }}>
              {encabezado}
              <h2 className="font-extrabold uppercase" style={{ ...est(tamano, "titulo"), ...tope(b("titulo").maxLineas) }}>
                {b("titulo").texto}
              </h2>
              {textos}
              <div className="mt-auto flex flex-col border-t-tinta" style={{ borderTopWidth: "0.9pt", paddingTop: "3pt", gap: "2pt" }}>
                <p className="whitespace-nowrap font-extrabold" style={est(tamano, "folio")}>
                  {ficha.folio}
                </p>
                <div className="flex items-center justify-between" style={{ gap: "6pt" }}>
                  <p className="min-w-0 font-bold" style={est(tamano, "indicacion")}>
                    {b("indicacion").texto}
                  </p>
                  <div className="shrink-0">{codigo}</div>
                </div>
              </div>
              <p style={est(tamano, "pie")}>{b("pie").texto}</p>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
