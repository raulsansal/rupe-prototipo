import "server-only";
// HU 056 (P6c): reporte estadístico con la base histórica más lo creado después de la siembra. Se calcula al generarlo y no se guarda (HU 057, regla 1).
import { ESTADOS_CASO } from "../../../mocks/tipos";
import { ID_ALCALDIA_FUERA_DE_LA_CIUDAD } from "../../../config/catalogos";
import { validacion } from "../../errores";
import { ahoraUTC, hoyCDMX } from "../../dominio/fechas";
import { generarReporte, INICIO_DE_DATOS, validarFiltrosDeReporte, type CifrasReporte, type FiltrosReporte } from "../../dominio/estadisticas";
import type { DatosEstadisticos } from "../../dominio/capaReal";
import { aOpcionesDeReporte, aReporteAdmin, type FiltrosReporteVista, type OpcionesDeReporte, type ReporteAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";
import { barrasDeAlcaldia, barrasDeCierre, barrasDeEstadoCaso, barrasDeMotivo, gruposDeEstadoAnimal, huellaDeReporte, leerHechos, texto } from "./estadisticasComun";

export type EntradaDeFiltros = { desde?: unknown; hasta?: unknown; alcaldia?: unknown; categoria?: unknown; estadoCaso?: unknown };
export type ReporteCalculado = { filtros: FiltrosReporte; cifras: CifrasReporte | null; datos: DatosEstadisticos; vista: ReporteAdmin };

/** Valida los filtros (422 por campo), calcula y rotula. Lo usan la generación en pantalla y la exportación, así el archivo sale del MISMO cálculo. No exige sesión: la exigen quienes lo llaman. */
export async function calcularReporte(entrada: EntradaDeFiltros, ctx: Contexto): Promise<ReporteCalculado> {
  const { datos, hechos } = await leerHechos(ctx);
  const c = datos.catalogos;
  // La alcaldía filtra la del CASO: «Fuera de la Ciudad de México» (R14) nunca lo es, así que no se acepta aquí.
  const { filtros, errores } = validarFiltrosDeReporte(
    { desde: texto(entrada.desde), hasta: texto(entrada.hasta), alcaldia: texto(entrada.alcaldia), categoria: texto(entrada.categoria), estadoCaso: texto(entrada.estadoCaso) },
    { alcaldias: new Set(c.alcaldias.filter((a) => a.id !== ID_ALCALDIA_FUERA_DE_LA_CIUDAD).map((a) => a.id)), categorias: new Set(c.categoriasMotivo.map((x) => x.id)) },
  );
  if (!filtros) throw validacion(errores as Record<string, string>, "Revisa los filtros del reporte.");
  const cifras = generarReporte(hechos, filtros);
  const vistaFiltros: FiltrosReporteVista = {
    desde: filtros.desde, hasta: filtros.hasta,
    alcaldia: filtros.idAlcaldia === undefined ? null : { id: filtros.idAlcaldia, nombre: c.alcaldias.find((a) => a.id === filtros.idAlcaldia)!.nombre },
    categoria: filtros.idCategoria === undefined ? null : { id: filtros.idCategoria, nombre: c.categoriasMotivo.find((x) => x.id === filtros.idCategoria)!.nombre },
    estadoCaso: filtros.estadoCaso ?? null,
  };
  const generadoEn = ahoraUTC(ctx.reloj);
  const vista: ReporteAdmin = cifras
    ? aReporteAdmin({
        sinDatos: false, filtros: vistaFiltros, generadoEn, huella: huellaDeReporte(filtros, cifras), totalCasos: cifras.totalCasos, casosLocalizados: cifras.casosLocalizados, tasaRecuperacion: cifras.tasaRecuperacion, avistamientosOcultos: cifras.avistamientosOcultos,
        porMotivo: barrasDeMotivo(c, cifras.porCategoriaMotivo), porEstadoCaso: barrasDeEstadoCaso(c, cifras.porEstadoCaso), cierres: barrasDeCierre(cifras.cierres),
        porEstadoAnimal: gruposDeEstadoAnimal(c, cifras.porEstadoAnimal), porAlcaldiaAvistamiento: barrasDeAlcaldia(c, cifras.porAlcaldiaAvistamiento),
      })
    : aReporteAdmin({ sinDatos: true, filtros: vistaFiltros, generadoEn });
  return { filtros, cifras, datos, vista };
}

/** Rango obligatorio y válido (422 por campo); alcaldía y categoría por id; sin datos = `sinDatos: true` (no es un error). */
export async function generarReporteAdmin(sesion: SesionActual | undefined, entrada: EntradaDeFiltros = {}, ctx: Contexto = contextoPorDefecto()): Promise<ReporteAdmin> {
  exigirAdministrador(sesion);
  return (await calcularReporte(entrada, ctx)).vista;
}

/** Opciones de los selectores: todas las alcaldías del almacén (activas e inactivas) MENOS «Fuera de la Ciudad de México», que no puede ser la alcaldía de un caso; 5 categorías; 6 estados. */
export async function opcionesDeReporte(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<OpcionesDeReporte> {
  exigirAdministrador(sesion);
  const c = (await ctx.repos.estadisticas.leer()).catalogos;
  return aOpcionesDeReporte({
    alcaldias: c.alcaldias.filter((a) => a.id !== ID_ALCALDIA_FUERA_DE_LA_CIUDAD), categorias: c.categoriasMotivo, estadosCaso: [...ESTADOS_CASO], limites: { desde: INICIO_DE_DATOS, hasta: hoyCDMX(ctx.reloj) },
  });
}
