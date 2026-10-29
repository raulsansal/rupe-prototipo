// HU 041: filtros del listado de avistamientos (rango de fechas del AVISTAMIENTO, día de la Ciudad de México, y alcaldía). Opcionales y combinables; el servidor los valida siempre.
// Funciones puras: las usan el servicio y sus pruebas.
export type Filtros = { desde?: string; hasta?: string; alcaldia?: number };
export type ErroresDeFiltros = Partial<Record<"desde" | "hasta" | "alcaldia", string>>;
/** Lo que llega de la URL (texto sin confiar). */
export type EntradaDeFiltros = { desde?: unknown; hasta?: unknown; alcaldia?: unknown };

const AAAA_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const esDiaReal = (d: string) => {
  if (!AAAA_MM_DD.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`).getTime();
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d; // 30 de febrero y similares no existen (no se confía en el formato)
};
/** Día (AAAA-MM-DD) de la Ciudad de México (UTC−6) de un instante ISO en UTC. */
export const diaCDMX = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600_000).toISOString().slice(0, 10);

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : "\u0000invalido");

/**
 * `fechaRegistro`: instante (UTC) del registro del caso; el rango no puede ser anterior a su día en la Ciudad de México. `alcaldias`: catálogo completo (incluye «Fuera de la Ciudad de
 * México»). Devuelve los filtros VÁLIDOS y un error por cada campo inválido (el campo inválido no se aplica).
 */
export function validarFiltros(entrada: EntradaDeFiltros, { fechaRegistro, alcaldias }: { fechaRegistro: string; alcaldias: readonly { idAlcaldia: number }[] }): { filtros: Filtros; errores: ErroresDeFiltros } {
  const filtros: Filtros = {};
  const errores: ErroresDeFiltros = {};
  const registro = diaCDMX(fechaRegistro);
  const [d, h, a] = [texto(entrada.desde), texto(entrada.hasta), texto(entrada.alcaldia)];
  if (d) {
    if (!esDiaReal(d)) errores.desde = "Elige una fecha válida.";
    else if (d < registro) errores.desde = "El rango de fechas no puede ser anterior a la fecha de registro del caso.";
    else filtros.desde = d;
  }
  if (h) {
    if (!esDiaReal(h)) errores.hasta = "Elige una fecha válida.";
    else if (h < registro) errores.hasta = "El rango de fechas no puede ser anterior a la fecha de registro del caso.";
    else if (filtros.desde && h < filtros.desde) errores.hasta = "La fecha final no puede ser anterior a la inicial.";
    else filtros.hasta = h;
  }
  if (a) {
    const id = /^\d{1,3}$/.test(a) ? Number(a) : NaN;
    if (!alcaldias.some((x) => x.idAlcaldia === id)) errores.alcaldia = "Elige una alcaldía de la lista.";
    else filtros.alcaldia = id;
  }
  return { filtros, errores };
}

/** Aplica los filtros válidos a avistamientos con `fechaHora` (UTC) e `idAlcaldia`. */
export function aplicarFiltros<T extends { fechaHora: string; idAlcaldia: number }>(items: readonly T[], f: Filtros): T[] {
  return items.filter((x) => {
    const dia = diaCDMX(x.fechaHora);
    return (!f.desde || dia >= f.desde) && (!f.hasta || dia <= f.hasta) && (f.alcaldia === undefined || x.idAlcaldia === f.alcaldia);
  });
}
