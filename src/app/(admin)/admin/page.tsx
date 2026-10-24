import type { Metadata } from "next";
import { BotonActualizarTablero, FiltroPeriodo } from "@/components/features/tablero/ControlesTablero";
import { BarraApilada } from "@/components/ui/BarraApilada";
import { GraficaBarras } from "@/components/ui/GraficaBarras";
import { TarjetaIndicador } from "@/components/ui/TarjetaIndicador";
import { calcularTablero, errorDePeriodo, PERIODO_PREDETERMINADO } from "@/mocks/tablero";
import type { EstadoCaso } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Tablero · RUPE" };

// Los tramos usan los tonos propios de la barra (--barra-estado-*, un matiz por estado como en los chips, claro/oscuro alternados); las clases se escriben completas para Tailwind.
const COLOR_ESTADO: Record<EstadoCaso, string> = {
  Extraviado: "bg-barra-estado-extraviado",
  "En búsqueda": "bg-barra-estado-en-busqueda",
  "Avistamiento reportado": "bg-barra-estado-avistamiento",
  "En seguimiento": "bg-barra-estado-en-seguimiento",
  Localizado: "bg-barra-estado-localizado",
  Cerrado: "bg-barra-estado-cerrado",
};

const texto = (p: string | string[] | undefined) => (typeof p === "string" ? p : "");

/** ADM-01 (HU 055). ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD fija el periodo; si falta o no es válido, se usa el del 1 al 18 de octubre de 2026. */
export default async function Tablero({ searchParams }: PageProps<"/admin">) {
  const q = await searchParams;
  const pedido = { desde: texto(q.desde), hasta: texto(q.hasta) };
  const periodo = pedido.desde && pedido.hasta && !errorDePeriodo(pedido) ? pedido : { ...PERIODO_PREDETERMINADO };
  const t = calcularTablero(periodo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Tablero</h1>
        <BotonActualizarTablero />
      </div>
      <FiltroPeriodo key={`${periodo.desde}-${periodo.hasta}`} periodo={periodo} />
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <TarjetaIndicador icono="pets" titulo="Casos activos" valor={String(t.casosActivos)} descripcion="Casos registrados en el periodo en Extraviado, En búsqueda, Avistamiento reportado o En seguimiento" />
        <TarjetaIndicador icono="check_circle" titulo="Casos localizados" valor={String(t.casosLocalizados)} descripcion="Casos registrados en el periodo en «Localizado» o con cierre confirmado" />
        <TarjetaIndicador icono="visibility" titulo="Total de avistamientos" valor={String(t.totalAvistamientos)} descripcion="Del periodo; solo avistamientos visibles" />
        <TarjetaIndicador icono="schedule" titulo="Promedio de tiempo de localización" valor={t.promedioLocalizacion === null ? "—" : `${t.promedioLocalizacion.toFixed(1)} días`} descripcion="Del registro a la localización, de los casos registrados en el periodo" />
        <TarjetaIndicador icono="visibility_off" titulo="Avistamientos ocultos" valor={String(t.avistamientosOcultos)} descripcion="Del periodo; ocultos por moderación, no se cuentan en el total" />
      </section>
      {/* En escritorio, dos columnas independientes (cada una apila sus tarjetas, sin filas alineadas ni huecos). En móvil `contents` + `order`
          devuelven el orden de siempre (motivo, estado, cierres, animal, alcaldía): las tarjetas son figuras independientes. */}
      <section aria-label="Gráficas" className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-3">
          <GraficaBarras className="order-1" titulo="Casos por categoría de motivo" subtitulo="Respeta el periodo seleccionado" grupos={[{ barras: t.porMotivo }]} />
          <GraficaBarras className="order-3" titulo="Casos cerrados por tipo de cierre" subtitulo="Cierres ocurridos en el periodo, por fecha del movimiento de cierre" grupos={[{ barras: t.cierres }]} />
          <GraficaBarras className="order-5" titulo="Avistamientos por alcaldía" subtitulo="Según la ubicación del avistamiento" grupos={[{ barras: t.porAlcaldia }]} />
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-3">
          <BarraApilada className="order-2" titulo="Casos por estado del caso" subtitulo="Estado actual de los casos registrados en el periodo" segmentos={t.porEstadoCaso.map((e) => ({ nombre: e.nombre, valor: e.valor, claseColor: COLOR_ESTADO[e.nombre as EstadoCaso] }))} />
          <GraficaBarras className="order-4" titulo="Avistamientos por estado del animal" subtitulo="Agrupados por categoría · un avistamiento cuenta en cada estado elegido" grupos={t.porEstadoAnimal.map((g) => ({ titulo: g.categoria, barras: g.barras }))} />
        </div>
      </section>
      <p className="text-caption text-text-muted">Datos ficticios. Cada gráfica tiene una tabla de datos alternativa para lectores de pantalla.</p>
    </div>
  );
}
