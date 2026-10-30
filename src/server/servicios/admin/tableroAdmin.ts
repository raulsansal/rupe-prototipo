import "server-only";
// HU 055 (P6c): tablero del Administrador con la base histórica más lo creado después de la siembra. Se calcula en cada petición (regla 2: tiempo real); no guarda nada.
import { validacion } from "../../errores";
import { ahoraUTC, hoyCDMX } from "../../dominio/fechas";
import { calcularTablero, erroresDePeriodo, INICIO_DE_DATOS, periodoPredeterminado } from "../../dominio/estadisticas";
import { aTableroAdmin, type TableroAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";
import { leerHechos, rotularTablero, texto } from "./estadisticasComun";

/** `desde` y `hasta` vacíos toman el periodo predeterminado (1 de octubre de 2026 o hoy, el menor, hasta hoy); si vienen, deben ser reales y no pasar de hoy (422 por campo). */
export async function consultarTablero(sesion: SesionActual | undefined, entrada: { desde?: unknown; hasta?: unknown } = {}, ctx: Contexto = contextoPorDefecto()): Promise<TableroAdmin> {
  exigirAdministrador(sesion);
  const hoy = hoyCDMX(ctx.reloj);
  const base = periodoPredeterminado(hoy);
  const periodo = { desde: texto(entrada.desde) || base.desde, hasta: texto(entrada.hasta) || base.hasta };
  const errores = erroresDePeriodo(periodo, hoy);
  if (errores.desde || errores.hasta) throw validacion(errores as Record<string, string>, "Revisa el periodo.");
  const { datos, hechos } = await leerHechos(ctx);
  const t = calcularTablero(hechos, periodo);
  return aTableroAdmin({
    periodo, limites: { desde: INICIO_DE_DATOS, hasta: hoy }, generadoEn: ahoraUTC(ctx.reloj),
    casosActivos: t.casosActivos, casosLocalizados: t.casosLocalizados, totalCasos: t.totalCasos, totalAvistamientos: t.totalAvistamientos, promedioLocalizacion: t.promedioLocalizacion, avistamientosOcultos: t.avistamientosOcultos,
    ...rotularTablero(datos.catalogos, t),
  });
}
