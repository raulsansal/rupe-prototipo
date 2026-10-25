import "server-only";
// Consultas públicas (ficha, estatus por folio) y reporte de avistamientos por los dos canales (QR con token, o folio). Reglas: R13, R26, R27, R33
// (tabla de decisión en dominio/visibilidad.ts). Los 404 son idénticos entre sí para no revelar por qué no se encuentra.
import type { FichaPublica } from "../../mocks/tipos";
import { ahoraUTC, validarFechaHoraAvistamiento } from "../dominio/fechas";
import { normalizarFolio } from "../dominio/folio";
import { sanearComentario, validarCoordenadas, validarFotografia, type FotoRecibida } from "../dominio/avistamientos";
import { IDS_EXCLUYENTES, validarEstadosAnimal } from "../dominio/estadosAnimal";
import { estadoActual, registrarMovimiento } from "../dominio/transiciones";
import { planRegeneracion } from "../dominio/qr";
import { errorNoEncontrado, exigirAdmiteAvistamientos, estatusPorFolioVisible, fichaPublicaVisible, situacionDe } from "../dominio/visibilidad";
import { formatoInvalido, noEncontrado, reglaDeNegocio } from "../errores";
import { aConfirmacionAvistamiento, aConsultaEstatus, aFichaPublica } from "../serializadores/publico";
import type { CasoExtravio, CodigoQr } from "../tipos";
import { contextoPorDefecto, historialDe, idDeEstado, type Contexto } from "./contexto";

const MENSAJE_QR = "Este código QR ya no está vigente.";

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

/** (a) Ficha pública por token del QR: el token se compara tal cual y debe estar vigente (R27). */
export async function consultarFichaPorToken(token: string, ctx: Contexto = contextoPorDefecto()): Promise<FichaPublica> {
  const qr = await ctx.repos.qr.porToken(token);
  if (!qr || qr.fechaInvalidacion !== null) throw errorNoEncontrado();
  return fichaDeCaso((await ctx.repos.casos.porId(qr.idCasoExtravio))!, ctx);
}

async function fichaDeCaso(caso: CasoExtravio, ctx: Contexto): Promise<FichaPublica> {
  const historial = await historialDe(ctx.repos, caso.idCasoExtravio);
  if (!fichaPublicaVisible(situacionDe(historial))) throw errorNoEncontrado();
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
 * (c) Valida el acceso al reporte. Canal «qr»: el token debe estar vigente (R27; se vuelve a verificar al registrar). Canal «folio»: solo se valida que el
 * folio corresponda a un caso que acepte avistamientos (R13, que incluye a los deshabilitados).
 */
export async function abrirReporteAvistamiento(acceso: Acceso, ctx: Contexto = contextoPorDefecto()): Promise<{ folio: string }> {
  const caso = await resolverAcceso(acceso, ctx);
  return { folio: caso.folio };
}

async function resolverAcceso(acceso: Acceso, ctx: Contexto): Promise<CasoExtravio> {
  let caso: CasoExtravio;
  if (acceso.canal === "qr") {
    const qr = await ctx.repos.qr.porToken(acceso.token);
    if (!qr || qr.fechaInvalidacion !== null) throw noEncontrado(MENSAJE_QR, "QR_NO_VIGENTE");
    caso = (await ctx.repos.casos.porId(qr.idCasoExtravio))!;
  } else caso = await casoPorFolio(acceso.folio, ctx);
  exigirAdmiteAvistamientos(situacionDe(await historialDe(ctx.repos, caso.idCasoExtravio)));
  return caso;
}

export type DatosAvistamiento = {
  fechaHoraAvistamiento: string; latitud: number; longitud: number; idAlcaldia: number; estadosAnimal: number[]; fotografia: FotoRecibida & { referenciaArchivo: string };
  direccionAproximada?: string; coloniaZona?: string; referenciasDelLugar?: string; precisionGps?: number; comentario?: string;
};

/**
 * Registra el avistamiento (R35): vuelve a validar el acceso (si el QR se regeneró entre abrir y registrar, se rechaza), aplica R3, R11, R14, R34, crea el
 * avistamiento con sus estados, mueve el caso a «Avistamiento reportado» (R12) y crea la notificación salvo que la persona tutora la haya desactivado (R25).
 */
export async function registrarAvistamiento(acceso: Acceso, datos: DatosAvistamiento, ctx: Contexto = contextoPorDefecto()) {
  const caso = await resolverAcceso(acceso, ctx);
  const { repos } = ctx;
  const estadosAnimal = await repos.catalogos.estadosAnimal();
  validarEstadosAnimal(datos.estadosAnimal, estadosAnimal.map((e) => ({ id: e.idEstadoAnimal, idCategoria: e.idCategoriaEstadoAnimal, excluyente: (IDS_EXCLUYENTES as readonly number[]).includes(e.idEstadoAnimal), activo: e.estatus === 1 })));
  validarCoordenadas(datos.latitud, datos.longitud);
  validarFechaHoraAvistamiento(datos.fechaHoraAvistamiento, ctx.reloj);
  validarFotografia(datos.fotografia, Number(await repos.parametros.valor("tamano_maximo_archivo_mb")));
  const alcaldia = (await repos.catalogos.alcaldias()).find((a) => a.idAlcaldia === datos.idAlcaldia);
  if (!alcaldia) throw reglaDeNegocio("R14", "La alcaldía del avistamiento no existe.", "ALCALDIA_INVALIDA");
  if (datos.direccionAproximada && datos.direccionAproximada.length > 200) throw formatoInvalido("DIRECCION_LARGA", "La dirección no puede pasar de 200 caracteres.");
  const ahora = ahoraUTC(ctx.reloj);
  const historial = await historialDe(repos, caso.idCasoExtravio);
  const nuevoHistorial = registrarMovimiento(historial, "avistamiento recibido", "automático", ahora); // 409 si el estado no lo permite
  const av = await repos.avistamientos.crear(
    { fechaHoraAvistamiento: datos.fechaHoraAvistamiento, direccionAproximada: datos.direccionAproximada, coloniaZona: datos.coloniaZona, referenciasDelLugar: datos.referenciasDelLugar, latitud: datos.latitud, longitud: datos.longitud, precisionGps: datos.precisionGps, comentario: sanearComentario(datos.comentario), fechaHoraEnvio: ahora, visible: true, idAlcaldia: alcaldia.idAlcaldia, idCasoExtravio: caso.idCasoExtravio },
    { referenciaArchivo: datos.fotografia.referenciaArchivo, formato: datos.fotografia.formato.toUpperCase() as "JPG" | "PNG", tamanoBytes: datos.fotografia.tamanoBytes, fechaCarga: ahora },
    datos.estadosAnimal,
  );
  const mov = nuevoHistorial[nuevoHistorial.length - 1];
  await repos.historial.agregar({ idCasoExtravio: caso.idCasoExtravio, fechaHora: ahora, tipoMovimiento: mov.tipo, idEstadoCaso: await idDeEstado(repos, mov.estado), idUsuario: null });
  await repos.casos.actualizarEstado(caso.idCasoExtravio, await idDeEstado(repos, mov.estado), ahora);
  const dueno = await repos.usuarios.porId((await repos.casos.perro(caso.idPerro))!.idUsuario);
  if (dueno?.notificacionesActivas) await repos.notificaciones.crear({ tipo: "nuevo avistamiento", canal: "correo", fechaEnvio: ahora, estadoEnvio: "enviada", idAvistamiento: av.idAvistamiento });
  return aConfirmacionAvistamiento(caso.folio, ahora);
}

/** HU 026 y R7: regenera el QR del caso; el anterior queda invalidado de inmediato y deja de abrir la ficha y el reporte. No cambia folio ni datos. */
export async function regenerarQr(idCaso: number, ctx: Contexto = contextoPorDefecto()): Promise<CodigoQr> {
  const qrs = await ctx.repos.qr.deCaso(idCaso);
  const plan = planRegeneracion(qrs.map((q) => q), idCaso, ahoraUTC(ctx.reloj));
  return ctx.repos.qr.regenerar(idCaso, plan.nuevo.tokenPublico, plan.nuevo.fechaGeneracion);
}
