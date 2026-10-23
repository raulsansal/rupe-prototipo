const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-18" → "18 oct 2026" (determinista, sin depender de ICU). */
export function formatearFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

/** ISO 8601 en UTC → "18 oct 2026, 10:30" en hora de la Ciudad de México (UTC−6, sin horario de verano). */
export function formatearFechaHora(iso: string): string {
  const local = new Date(new Date(iso).getTime() - 6 * 60 * 60 * 1000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const fecha = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
  return `${formatearFechaCorta(fecha)}, ${hh}:${mm}`;
}

/** ISO 8601 en UTC → "9 oct 2026" en hora de la Ciudad de México (UTC−6): una fecha cerca de la medianoche UTC puede cambiar de día. */
export function formatearFechaLocal(iso: string): string {
  return formatearFechaHora(iso).split(",")[0];
}

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-18" → "18 de octubre de 2026". */
export function formatearFechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return `${dia} de ${MESES_LARGOS[mes - 1]} de ${anio}`;
}

/** ISO 8601 en UTC → "AAAA-MM-DD" del día local en la Ciudad de México (UTC−6). */
export function fechaLocalISO(iso: string): string {
  return new Date(new Date(iso).getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
