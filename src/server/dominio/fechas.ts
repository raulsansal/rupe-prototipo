// «Hoy» de la Ciudad de México (R10 y E12): DATE(UTC_TIMESTAMP() - INTERVAL 6 HOUR), sin horario de verano. Una sola función para todo el servidor.
import { reglaDeNegocio } from "../errores";

export type Reloj = () => Date;
export const relojDelSistema: Reloj = () => new Date();
const MS_HORA = 3_600_000;

/** Fecha local de la Ciudad de México (AAAA-MM-DD) en el instante del reloj. */
export const hoyCDMX = (reloj: Reloj = relojDelSistema): string => new Date(reloj().getTime() - 6 * MS_HORA).toISOString().slice(0, 10);

/** Instante actual en UTC (ISO 8601), el formato de las columnas DATETIME. */
export const ahoraUTC = (reloj: Reloj = relojDelSistema): string => reloj().toISOString();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esFechaReal = (f: string) => FECHA.test(f) && !Number.isNaN(Date.parse(`${f}T00:00:00Z`)) && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f;

/** R10: la fecha del extravío (la que escribe la persona, en hora local) no es posterior al «hoy» de la Ciudad de México. */
export function validarFechaExtravio(fecha: string, reloj: Reloj = relojDelSistema): void {
  if (!esFechaReal(fecha)) throw reglaDeNegocio("R10", "La fecha del extravío no es una fecha válida (AAAA-MM-DD).", "FECHA_INVALIDA");
  if (fecha > hoyCDMX(reloj)) throw reglaDeNegocio("R10", "La fecha del extravío no puede ser posterior a la fecha actual.", "FECHA_FUTURA");
}

/** HU 033: la fecha y hora del avistamiento no son posteriores al momento del envío. */
export function validarFechaHoraAvistamiento(iso: string, reloj: Reloj = relojDelSistema): void {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw reglaDeNegocio("R14", "La fecha y hora del avistamiento no son válidas.", "FECHA_INVALIDA");
  if (t > reloj().getTime()) throw reglaDeNegocio("R14", "La fecha y hora no pueden ser posteriores al momento del envío.", "FECHA_FUTURA");
}
