import "server-only";
// F4 «Reportar un avistamiento» (HU 028 a 036), SIN cuenta: el canal es el folio o el QR vigente. El reporte es anónimo: no se guarda IP, agente de usuario ni ningún dato de quien
// lo envía, y la fotografía se vincula al ID del avistamiento. Todo se confirma en UNA transacción (avistamiento, estados, foto, movimiento de estado y notificación): si algo falla
// no queda nada. R24: sin bitácora (solo las acciones del Administrador la escriben).
import { FUERA_DE_LA_CIUDAD, type Alcaldia } from "../../mocks/tipos";
import { fechaHoraDeCDMX, sanearComentario, ubicacionSimulada } from "../dominio/avistamientos";
import { correoDeAvistamiento } from "../dominio/correo";
import { IDS_EXCLUYENTES, validarEstadosAnimal } from "../dominio/estadosAnimal";
import { ahoraUTC, validarFechaHoraAvistamiento } from "../dominio/fechas";
import { validarFotografiaRecibida } from "../dominio/fotografia";
import { estadoActual, registrarMovimiento } from "../dominio/transiciones";
import { ErrorApp, validacion } from "../errores";
import { LADO_MAXIMO_CASO, prepararImagen } from "../imagenes/prepararImagen";
import { aConfirmacionDeReporte } from "../serializadores/publico";
import { contextoPorDefecto, historialDe, idDeEstado, type Contexto } from "./contexto";
import type { FotoDeEntrada } from "./extravio";
import { consultarFichaPorFolio, resolverAcceso, type Acceso } from "./fichas";

export const LIMITES = { direccion: 200, coloniaZona: 100, referencias: 500, comentario: 300 } as const;
const ID_ESTADO_FALLECIDO = 5;

/** Lo que se lee del cliente (lista permitida: cualquier otro campo se ignora). Fecha y hora son las de la Ciudad de México. */
export type DatosDeAvistamiento = { fecha: string; hora: string; direccion: string; idAlcaldia: number; coloniaZona?: string; referencias?: string; estadosAnimal: number[]; comentario?: string };

const texto = (v: unknown) => (typeof v === "string" ? v : "");
export function leerDatosDeAvistamiento(crudo: unknown): DatosDeAvistamiento {
  const o = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;
  const ids = Array.isArray(o.estadosAnimal) ? o.estadosAnimal.filter((x): x is number => typeof x === "number" && Number.isInteger(x)) : [];
  return {
    fecha: texto(o.fecha).trim(), hora: texto(o.hora).trim(), direccion: texto(o.direccion), idAlcaldia: typeof o.idAlcaldia === "number" ? o.idAlcaldia : Number.NaN,
    coloniaZona: texto(o.coloniaZona), referencias: texto(o.referencias), estadosAnimal: Array.isArray(o.estadosAnimal) && ids.length !== o.estadosAnimal.length ? [-1] : ids, comentario: texto(o.comentario),
  };
}

/**
 * Registra el avistamiento (HU 035). Orden: acceso (folio o QR vigente; 404/409 antes de mirar los datos), validación por campo (422), foto (re-codificada en el servidor sin EXIF),
 * aviso simulado a la persona tutora (su fallo NO impide el registro) y alta atómica. Devuelve solo el ID, el folio y la fecha de envío: nunca el token ni nada de la persona tutora.
 */
export async function registrarAvistamiento(acceso: Acceso, entrada: { datos: unknown; foto?: FotoDeEntrada }, ctx: Contexto = contextoPorDefecto()) {
  const caso = await resolverAcceso(acceso, ctx); // R13, R27, R33: se vuelve a verificar aquí aunque la pantalla ya lo hizo
  const { repos } = ctx;
  const d = leerDatosDeAvistamiento(entrada.datos);
  const campos: Record<string, string> = {};

  const alcaldias = await repos.catalogos.alcaldias();
  const alcaldia = alcaldias.find((a) => a.idAlcaldia === d.idAlcaldia);
  if (!d.direccion.trim()) campos.direccion = "Escribe una dirección aproximada.";
  else if (d.direccion.trim().length > LIMITES.direccion) campos.direccion = `La dirección no puede pasar de ${LIMITES.direccion} caracteres.`;
  if (!alcaldia || alcaldia.estatus !== 1 || alcaldia.nombre === FUERA_DE_LA_CIUDAD) campos.alcaldia = "Elige una alcaldía de la Ciudad de México.";
  if ((d.coloniaZona ?? "").trim().length > LIMITES.coloniaZona) campos.coloniaZona = `La colonia o zona no puede pasar de ${LIMITES.coloniaZona} caracteres.`;
  if ((d.referencias ?? "").trim().length > LIMITES.referencias) campos.referencias = `Las referencias no pueden pasar de ${LIMITES.referencias} caracteres.`;

  const instante = d.fecha && d.hora ? fechaHoraDeCDMX(d.fecha, d.hora) : undefined;
  if (!d.fecha) campos.fecha = "Elige la fecha en que lo viste.";
  else if (!d.hora) campos.hora = "Elige la hora en que lo viste.";
  else if (!instante) campos.fecha = "La fecha o la hora no son válidas.";
  else
    try {
      validarFechaHoraAvistamiento(instante, ctx.reloj);
    } catch (e) {
      campos.hora = e instanceof ErrorApp ? e.message : "La fecha y la hora no son válidas.";
    }

  const estados = await repos.catalogos.estadosAnimal();
  try {
    validarEstadosAnimal(d.estadosAnimal, estados.map((e) => ({ id: e.idEstadoAnimal, idCategoria: e.idCategoriaEstadoAnimal, excluyente: (IDS_EXCLUYENTES as readonly number[]).includes(e.idEstadoAnimal), activo: e.estatus === 1 })));
  } catch (e) {
    campos.estadosAnimal = e instanceof ErrorApp ? e.message : "El estado del animal no es válido.";
  }

  let comentario: string | undefined;
  try {
    comentario = sanearComentario(d.comentario);
  } catch (e) {
    campos.comentario = e instanceof ErrorApp ? e.message : "El comentario no es válido.";
  }

  const maximoMb = Number(await repos.parametros.valor("tamano_maximo_archivo_mb"));
  let foto: { bytes: Uint8Array } | undefined;
  if (!entrada.foto || entrada.foto.bytes.length === 0) campos.foto = "La fotografía es obligatoria. Toma o elige una foto del perro.";
  else {
    const f = validarFotografiaRecibida(entrada.foto, maximoMb);
    if ("error" in f) campos.foto = f.error;
    else
      try {
        foto = { bytes: (await prepararImagen(entrada.foto.bytes, { tipo: "lado", maximo: LADO_MAXIMO_CASO })).bytes }; // orientación aplicada, 1600 px, JPEG, sin EXIF ni ubicación
      } catch {
        campos.foto = "La fotografía debe ser JPG o PNG."; // misma respuesta que un archivo que no es una imagen
      }
  }
  if (Object.keys(campos).length || !foto || !alcaldia || !instante) throw validacion(campos);

  // Estado del caso (E1, R12): «avistamiento recibido» lleva a «Avistamiento reportado»; si ya está ahí no se duplica el movimiento.
  const ahora = ahoraUTC(ctx.reloj);
  const historial = await historialDe(repos, caso.idCasoExtravio);
  const yaReportado = estadoActual(historial) === "Avistamiento reportado";
  if (!yaReportado) registrarMovimiento(historial, "avistamiento recibido", "automático", ahora); // 409 si la matriz no lo permite
  const idReportado = await idDeEstado(repos, "Avistamiento reportado");

  // Aviso simulado (HU 036): sin contacto de quien reporta; con «Fallecido» sin el resumen del estado; nada si la persona tutora lo desactivó (R25). Su fallo no impide el registro.
  const perro = (await repos.casos.perro(caso.idPerro))!;
  const tutor = await repos.usuarios.porId(perro.idUsuario);
  let notificacion: { tipo: "nuevo avistamiento"; canal: "correo"; fechaEnvio: string; estadoEnvio: "enviada" | "fallida"; mensajeSimulado: { asunto: string; cuerpo: string[] } } | undefined;
  if (tutor?.notificacionesActivas) {
    const nombres = estados.filter((e) => d.estadosAnimal.includes(e.idEstadoAnimal)).map((e) => e.nombre);
    const mensaje = correoDeAvistamiento({ nombreDeLaPersona: tutor.nombreCompleto, folio: caso.folio, nombreDelPerro: perro.nombre, estadosAnimal: nombres, fallecido: d.estadosAnimal.includes(ID_ESTADO_FALLECIDO) });
    let resultado: "enviada" | "fallida" = "enviada";
    try {
      await ctx.enviarNotificacion?.(mensaje, { idUsuario: tutor.idUsuario });
    } catch {
      resultado = "fallida";
    }
    notificacion = { tipo: "nuevo avistamiento", canal: "correo", fechaEnvio: ahora, estadoEnvio: resultado, mensajeSimulado: { asunto: mensaje.asunto, cuerpo: mensaje.cuerpo } };
  }

  const ubicacion = ubicacionSimulada(alcaldia.nombre as Alcaldia, d.direccion);
  const { avistamiento } = await repos.avistamientos.registrarCompleto({
    avistamiento: {
      fechaHoraAvistamiento: instante, direccionAproximada: d.direccion.trim(), coloniaZona: (d.coloniaZona ?? "").trim() || undefined, referenciasDelLugar: (d.referencias ?? "").trim() || undefined,
      latitud: ubicacion.latitud, longitud: ubicacion.longitud, comentario, fechaHoraEnvio: ahora, visible: true, idAlcaldia: alcaldia.idAlcaldia, idCasoExtravio: caso.idCasoExtravio, ubicacionSimulada: true,
    },
    fotografia: { referenciaArchivo: "", formato: "JPG", tamanoBytes: foto.bytes.length, fechaCarga: ahora },
    contenidoFotografia: { tipo: "image/jpeg", bytes: foto.bytes },
    estados: d.estadosAnimal,
    movimiento: yaReportado ? undefined : { fechaHora: ahora, tipoMovimiento: "avistamiento recibido", idEstadoCaso: idReportado },
    notificacion,
  });
  return aConfirmacionDeReporte(avistamiento.idAvistamiento, caso.folio, ahora);
}

/**
 * Al ENTRAR a la pantalla de reportar (HU 028) se valida de inmediato el acceso: folio o QR vigente, caso que admita avistamientos. 404 (folio no encontrado o QR_NO_VIGENTE) y 409 (R13)
 * salen tal cual para que la pantalla muestre su mensaje sin dejar llenar el formulario; el POST vuelve a validar. Devuelve solo lo público del caso y el catálogo de alcaldías.
 */
export async function iniciarReporte(acceso: Acceso, ctx: Contexto = contextoPorDefecto()) {
  const caso = await resolverAcceso(acceso, ctx);
  const ficha = await consultarFichaPorFolio(caso.folio, ctx);
  const alcaldias = (await ctx.repos.catalogos.alcaldias()).filter((a) => a.estatus === 1 && a.nombre !== FUERA_DE_LA_CIUDAD).map((a) => ({ id: a.idAlcaldia, nombre: a.nombre }));
  // Solo las opciones ACTIVAS del catálogo, de la misma fuente que usa la validación del POST.
  const estadosAnimal = (await ctx.repos.catalogos.estadosAnimal()).filter((e) => e.estatus === 1).map((e) => ({ id: e.idEstadoAnimal, idCategoria: e.idCategoriaEstadoAnimal, nombre: e.nombre, descripcion: e.descripcion, excluyente: (IDS_EXCLUYENTES as readonly number[]).includes(e.idEstadoAnimal) }));
  return { folio: ficha.folio, nombre: ficha.nombre, fotografiaUrl: ficha.fotografiaUrl, alcaldias, estadosAnimal, maximoMb: Math.min(Number(await ctx.repos.parametros.valor("tamano_maximo_archivo_mb")), 4.5) };
}
