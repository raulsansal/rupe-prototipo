import "server-only";
// Consultas públicas (ficha, estatus por folio) y reporte de avistamientos por los dos canales (QR con token, o folio). Reglas: R13, R26, R27, R33
// (tabla de decisión en dominio/visibilidad.ts). Los 404 son idénticos entre sí para no revelar por qué no se encuentra.
import type { FichaPublica } from "../../mocks/tipos";
import { ahoraUTC } from "../dominio/fechas";
import { normalizarFolio } from "../dominio/folio";
import { estadoActual } from "../dominio/transiciones";
import { planRegeneracion } from "../dominio/qr";
import { errorNoEncontrado, errorQrNoVigente, exigirAdmiteAvistamientos, estatusPorFolioVisible, fichaPublicaVisible, situacionDe } from "../dominio/visibilidad";
import type { ErrorApp } from "../errores";
import { aConsultaEstatus, aFichaPublica } from "../serializadores/publico";
import type { CasoExtravio, CodigoQr } from "../tipos";
import { exigirAccesoAlCaso, type SesionActual } from "../sesion/guardas";
import { contextoPorDefecto, historialDe, type Contexto } from "./contexto";

async function casoPorFolio(folio: string, ctx: Contexto): Promise<CasoExtravio> {
  const caso = await ctx.repos.casos.porFolio(normalizarFolio(folio));
  if (!caso) throw errorNoEncontrado();
  return caso;
}

/** (a) Ficha pública por folio: solo columnas P; 404 si no existe o el caso está cerrado (R33). R26: el folio no distingue mayúsculas. */
export async function consultarFichaPorFolio(folio: string, ctx: Contexto = contextoPorDefecto()): Promise<FichaPublica> {
  const caso = await casoPorFolio(folio, ctx);
  return fichaDeCaso(caso, ctx);
}

/** (a) Ficha pública por token del QR: el token se compara en tiempo constante, distingue mayúsculas y debe estar vigente (R27). Cualquier fallo responde lo mismo (QR_NO_VIGENTE). */
export async function consultarFichaPorToken(token: string, ctx: Contexto = contextoPorDefecto()): Promise<FichaPublica> {
  const qr = await ctx.repos.qr.porToken(token);
  if (!qr || qr.fechaInvalidacion !== null) throw errorQrNoVigente();
  return fichaDeCaso((await ctx.repos.casos.porId(qr.idCasoExtravio))!, ctx, errorQrNoVigente);
}

async function fichaDeCaso(caso: CasoExtravio, ctx: Contexto, errorSiNoSeMuestra: () => ErrorApp = errorNoEncontrado): Promise<FichaPublica> {
  const historial = await historialDe(ctx.repos, caso.idCasoExtravio);
  if (!fichaPublicaVisible(situacionDe(historial))) throw errorSiNoSeMuestra();
  const [perro, alcaldias, razas] = [await ctx.repos.casos.perro(caso.idPerro), await ctx.repos.catalogos.alcaldias(), await ctx.repos.catalogos.razas()];
  const foto = (await ctx.repos.casos.fotografia(perro!.idFotografia))!;
  return aFichaPublica(caso, perro!, foto, {
    raza: razas.find((r) => r.idRaza === perro!.idRaza)!.nombre,
    alcaldia: alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)!.nombre as FichaPublica["alcaldia"],
    estado: estadoActual(historial)!,
  });
}

/** (b) Consulta de estatus por folio (HU 038): estatus y fecha del último cambio; 404 si es cancelado, deshabilitado o inexistente (R33). */
export async function consultarEstatusPorFolio(folio: string, ctx: Contexto = contextoPorDefecto()) {
  const caso = await casoPorFolio(folio, ctx);
  const historial = await historialDe(ctx.repos, caso.idCasoExtravio);
  if (!estatusPorFolioVisible(situacionDe(historial))) throw errorNoEncontrado();
  const ultimo = historial[historial.length - 1];
  return aConsultaEstatus(caso.folio, ultimo.estado, ultimo.fechaHora);
}

// ---------------------------------------------------------------------------------------------------------------- reporte de avistamientos
/** Canal de entrada al reporte (HU 028): «qr» con el token del código, o «folio». */
export type Acceso = { canal: "qr"; token: string } | { canal: "folio"; folio: string };

/**
 * (c) Valida el acceso al reporte (HU 028). Canal «qr»: el token debe estar vigente (R27; se vuelve a verificar al registrar) y el caso mostrable: un token inexistente, mal
 * formado, regenerado o de un caso cerrado, cancelado o deshabilitado responde LO MISMO (QR_NO_VIGENTE, 404); un QR vigente de un caso Localizado da 409 (R13). Canal «folio»:
 * solo se valida que el folio corresponda a un caso que acepte avistamientos (R13 y R33); el reporte por folio funciona aunque el QR haya cambiado.
 */
export async function abrirReporteAvistamiento(acceso: Acceso, ctx: Contexto = contextoPorDefecto()): Promise<{ folio: string }> {
  const caso = await resolverAcceso(acceso, ctx);
  return { folio: caso.folio };
}

export async function resolverAcceso(acceso: Acceso, ctx: Contexto): Promise<CasoExtravio> {
  if (acceso.canal === "folio") {
    const caso = await casoPorFolio(acceso.folio, ctx);
    exigirAdmiteAvistamientos(situacionDe(await historialDe(ctx.repos, caso.idCasoExtravio)));
    return caso;
  }
  const qr = await ctx.repos.qr.porToken(acceso.token);
  if (!qr || qr.fechaInvalidacion !== null) throw errorQrNoVigente();
  const caso = (await ctx.repos.casos.porId(qr.idCasoExtravio))!;
  const situacion = situacionDe(await historialDe(ctx.repos, caso.idCasoExtravio));
  if (!situacion || situacion.estado === "Cerrado") throw errorQrNoVigente(); // cerrado, cancelado o deshabilitado: indistinguible de un QR que no existe
  exigirAdmiteAvistamientos(situacion); // Localizado: 409 (R13)
  return caso;
}

/**
 * Foto del caso para la ficha PÚBLICA (HU 024): solo la foto del PERRO (nunca la de un avistamiento) y solo mientras la ficha se muestre (R33). Un folio inexistente, cancelado,
 * deshabilitado o cerrado, o un caso sin foto subida (marcador sembrado), responden el mismo 404.
 */
export async function fotografiaPublicaDelCaso(folio: string, ctx: Contexto = contextoPorDefecto()): Promise<{ tipo: "image/jpeg"; bytes: Uint8Array }> {
  const caso = await ctx.repos.casos.porFolio(normalizarFolio(folio));
  if (!caso || !fichaPublicaVisible(situacionDe(await historialDe(ctx.repos, caso.idCasoExtravio)))) throw errorNoEncontrado();
  const perro = (await ctx.repos.casos.perro(caso.idPerro))!;
  const contenido = await ctx.repos.casos.contenidoDeFotografia(perro.idFotografia);
  if (!contenido || contenido.tipo !== "image/jpeg") throw errorNoEncontrado();
  return { tipo: "image/jpeg", bytes: contenido.bytes };
}

/**
 * HU 026 y R7: regenera el QR del caso; el anterior queda invalidado de inmediato y deja de abrir la ficha y el reporte. No cambia folio ni datos.
 * Aplica por sí mismo la guarda de sesión, rol y dueño (R32): solo la persona tutora dueña (401 sin sesión, 404 si es otra tutora, 403 al Administrador).
 */
export async function regenerarQr(sesion: SesionActual | undefined, idCaso: number, ctx: Contexto = contextoPorDefecto()): Promise<CodigoQr> {
  const caso = await ctx.repos.casos.porId(idCaso);
  const dueno = caso && (await ctx.repos.casos.perro(caso.idPerro))?.idUsuario;
  exigirAccesoAlCaso(sesion, dueno ?? -1, "editar");
  if (!caso) throw errorNoEncontrado();
  const qrs = await ctx.repos.qr.deCaso(idCaso);
  const plan = planRegeneracion(qrs.map((q) => q), idCaso, ahoraUTC(ctx.reloj));
  return ctx.repos.qr.regenerar(idCaso, plan.nuevo.tokenPublico, plan.nuevo.fechaGeneracion);
}
