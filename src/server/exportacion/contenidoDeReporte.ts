// Contenido del archivo de exportación (HU 057): una sola estructura de la que salen el PDF y el Excel, para que digan lo mismo que la pantalla. Solo agregados: nunca datos de personas.
import { formatearFechaCorta, formatearFechaHora } from "../../lib/formato";
import type { ReporteAdmin } from "../serializadores/admin";

export type TablaDeReporte = { hoja: string; titulo: string; columnas: [string, string]; filas: [string, number][] };
export type ContenidoDeReporte = {
  titulo: string; generado: string;
  filtros: [string, string][];
  /** Valor null = sin dato (tasa sin casos que cuenten). `porcentaje` se escribe como número con un decimal (11,9 = 11,9 %). */
  indicadores: { rotulo: string; valor: number | null; tipo: "entero" | "porcentaje" }[];
  tablas: TablaDeReporte[];
  notas: string[];
};

export function contenidoDeReporte(r: Extract<ReporteAdmin, { sinDatos: false }>): ContenidoDeReporte {
  const generado = formatearFechaHora(r.generadoEn);
  const f = r.filtros;
  return {
    titulo: "Reporte estadístico de casos",
    generado: `${generado} (hora de la Ciudad de México)`,
    filtros: [["Periodo", `${formatearFechaCorta(f.desde)} – ${formatearFechaCorta(f.hasta)}`], ["Alcaldía", f.alcaldia?.nombre ?? "todas"], ["Categoría de motivo", f.categoria?.nombre ?? "todas"], ["Estado del caso", f.estadoCaso ?? "todos"]],
    indicadores: [
      { rotulo: "Número de casos", valor: r.totalCasos, tipo: "entero" }, { rotulo: "Casos localizados", valor: r.casosLocalizados, tipo: "entero" },
      { rotulo: "Tasa de recuperación (%)", valor: r.tasaRecuperacion, tipo: "porcentaje" }, { rotulo: "Avistamientos ocultos (aparte)", valor: r.avistamientosOcultos, tipo: "entero" },
    ],
    tablas: [
      { hoja: "Casos por motivo", titulo: "Casos por categoría de motivo", columnas: ["Categoría de motivo", "Casos"], filas: r.porMotivo.map((b) => [b.nombre, b.valor]) },
      { hoja: "Casos por estado", titulo: "Casos por estado del caso", columnas: ["Estado del caso", "Casos"], filas: r.porEstadoCaso.map((b) => [b.nombre, b.valor]) },
      { hoja: "Cierres por tipo", titulo: "Casos cerrados por tipo de cierre", columnas: ["Tipo de cierre", "Casos"], filas: r.cierres.map((b) => [b.nombre, b.valor]) },
      { hoja: "Estado del animal", titulo: "Avistamientos por estado del animal", columnas: ["Estado del animal", "Avistamientos"], filas: r.porEstadoAnimal.flatMap((g) => g.barras.map((b): [string, number] => [`${g.categoria}: ${b.nombre}`, b.valor])) },
      { hoja: "Alcaldía del avistamiento", titulo: "Avistamientos por alcaldía del avistamiento", columnas: ["Alcaldía del avistamiento", "Avistamientos"], filas: r.porAlcaldiaAvistamiento.map((b) => [b.nombre, b.valor]) },
    ],
    notas: [
      "La tasa de recuperación no cuenta casos cancelados ni deshabilitados.",
      "Las cuentas de avistamientos solo incluyen los visibles; los ocultos se informan aparte.",
      `Reporte generado el ${generado}; el sistema no lo almacena.`,
    ],
  };
}
