import "server-only";
// F3 «Ficha de búsqueda» (HU 019 a 023, 026 y 027): vista previa, PDF real, QR real y regeneración. La guarda de sesión, rol y dueño (R32) va AQUÍ, dentro de cada servicio:
// 401 sin sesión, 403 al Administrador (la ficha es solo de su dueña), 404 uniforme para un caso ajeno, inexistente o mal formado. DESPUÉS de la guarda se valida la hoja (400) y,
// por último, el estado: solo los casos en curso (Extraviado, En búsqueda, Avistamiento reportado, En seguimiento) pueden previsualizar, generar el PDF, compartir y regenerar el QR;
// Localizado y Cerrado (incluidos cancelado y deshabilitado) dan 409 y conservan su último QR. Sin bitácora (R24) y sin movimiento de historial: regenerar el QR no cambia el estado.
import { fichaParaHoja } from "../../lib/ficha/aHoja";
import { formatearFechaLarga } from "../../lib/formato";
import { esCasoActivo, type FichaPublica } from "../../mocks/tipos";
import { ahoraUTC } from "../dominio/fechas";
import { normalizarFolio } from "../dominio/folio";
import { generarTokenQr, planRegeneracion } from "../dominio/qr";
import { conflictoDeEstado, ErrorApp } from "../errores";
import { exigirBasePublica, MENSAJE_FALTA_URL, type BasePublica } from "../config/urlPublica";
import { generarFichaPdf } from "../pdf/generarFichaPdf";
import { matrizQr, urlDelQr, urlParaCompartir, type MatrizQr } from "../qr/matrizQr";
import { ConflictoDeUnicidad } from "../repos/errores";
import type { SesionActual } from "../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "./contexto";
import { fichaDelTutor } from "./misRegistros";

export const HOJAS = ["carta", "media-carta"] as const;
export type Hoja = (typeof HOJAS)[number];
export const MENSAJE_NO_ACTIVO = "La ficha de búsqueda solo está disponible mientras el caso sigue en curso (Extraviado, En búsqueda, Avistamiento reportado o En seguimiento).";

async function fichaPermitida(sesion: SesionActual | undefined, folio: string, ctx: Contexto): Promise<FichaPublica> {
  const ficha = await fichaDelTutor(sesion, folio, ctx); // guarda: 401, 403 y 404 uniforme
  if (!esCasoActivo(ficha.estado)) throw conflictoDeEstado("CASO_NO_ACTIVO", MENSAJE_NO_ACTIVO);
  return ficha;
}

export type VistaDeFicha = {
  /** Solo campos públicos: nunca datos de la persona tutora ni reservados. */
  ficha: FichaPublica;
  /** Enlace público que se comparte: lleva el FOLIO, no el token (no se invalida al regenerar el QR). */
  enlaceCompartir: string | null;
  dominio: string | null;
  /** Matriz del QR con el token VIGENTE; null si falta la URL pública configurada (la hoja avisa en su lugar). */
  qr: MatrizQr | null;
  avisoQr: string | null;
  /** Fecha (UTC) de generación del QR vigente: la de la última regeneración si la hubo. */
  fechaQr: string;
};

/** Vista previa de la ficha (HU 019): ficha pública, QR vigente y enlace para compartir. 409 si el caso ya no está en curso. */
export async function fichaDeBusquedaDelTutor(sesion: SesionActual | undefined, folio: string, base: BasePublica, ctx: Contexto = contextoPorDefecto()): Promise<VistaDeFicha> {
  const ficha = await fichaPermitida(sesion, folio, ctx);
  const caso = (await ctx.repos.casos.porFolio(ficha.folio))!;
  const vigente = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!;
  if (!base.ok) return { ficha, enlaceCompartir: null, dominio: null, qr: null, avisoQr: MENSAJE_FALTA_URL, fechaQr: vigente.fechaGeneracion };
  return { ficha, enlaceCompartir: urlParaCompartir(base.base, ficha.folio), dominio: base.dominio, qr: matrizQr(urlDelQr(base.base, vigente.tokenPublico)), avisoQr: null, fechaQr: vigente.fechaGeneracion };
}

/** PDF de la ficha (HU 020, 022 y 027), generado al momento con los datos más recientes. Orden: guarda y propiedad, hoja (400), estado (409), URL pública (503). */
export async function generarPdfDeFicha(sesion: SesionActual | undefined, folio: string, hoja: unknown, base: BasePublica, ctx: Contexto = contextoPorDefecto()): Promise<{ bytes: Uint8Array; nombreArchivo: string }> {
  const ficha = await fichaDelTutor(sesion, folio, ctx); // guarda primero: un caso ajeno no debe enterarse de si la hoja era válida
  const tamano = hoja === undefined || hoja === null || hoja === "" ? "carta" : HOJAS.find((h) => h === hoja);
  if (!tamano) throw new ErrorApp(400, "HOJA_INVALIDA", "El tamaño de hoja debe ser «carta» o «media-carta».");
  if (!esCasoActivo(ficha.estado)) throw conflictoDeEstado("CASO_NO_ACTIVO", MENSAJE_NO_ACTIVO);
  const { base: url, dominio } = exigirBasePublica(base);
  const caso = (await ctx.repos.casos.porFolio(ficha.folio))!;
  const vigente = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!;
  const idFoto = /\/api\/fotografias\/(\d+)$/.exec(ficha.fotografiaUrl)?.[1];
  const foto = idFoto ? (await ctx.repos.casos.contenidoDeFotografia(Number(idFoto)))?.bytes : undefined;
  const bytes = await generarFichaPdf({
    ficha: fichaParaHoja(ficha), fechaLarga: formatearFechaLarga(ficha.fechaExtravio), dominio, tamano, qr: matrizQr(urlDelQr(url, vigente.tokenPublico)), foto, ahora: new Date(ahoraUTC(ctx.reloj)),
  });
  return { bytes, nombreArchivo: `ficha-${ficha.folio}-${tamano}.pdf` };
}

/**
 * Regenera el QR (HU 026, R7): el anterior queda invalidado de inmediato y el nuevo nace en la MISMA transacción. No cambia folio, datos, estado ni historial; la fecha de
 * regeneración es la `fecha_generacion` del nuevo código. El cuerpo de la petición no interviene: no hay asignación masiva. No devuelve el token.
 */
export async function regenerarQrDelTutor(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<{ fechaRegeneracion: string }> {
  const ficha = await fichaPermitida(sesion, folio, ctx);
  const caso = (await ctx.repos.casos.porFolio(normalizarFolio(ficha.folio)))!;
  const ahora = ahoraUTC(ctx.reloj);
  for (let intento = 0; ; intento++) {
    const plan = planRegeneracion(await ctx.repos.qr.deCaso(caso.idCasoExtravio), caso.idCasoExtravio, ahora, generarTokenQr);
    try {
      const nuevo = await ctx.repos.qr.regenerar(caso.idCasoExtravio, plan.nuevo.tokenPublico, ahora);
      return { fechaRegeneracion: nuevo.fechaGeneracion };
    } catch (e) {
      if (e instanceof ConflictoDeUnicidad && intento < 5) continue; // token repetido: nada quedó guardado, se genera otro
      throw e;
    }
  }
}

/** Enlace público para compartir (HU 023): `<base>/ficha/<FOLIO>`. Solo con el caso en curso (409 si no); null si falta la URL pública. */
export async function enlaceParaCompartir(sesion: SesionActual | undefined, folio: string, base: BasePublica, ctx: Contexto = contextoPorDefecto()): Promise<string | null> {
  const ficha = await fichaPermitida(sesion, folio, ctx);
  return base.ok ? urlParaCompartir(base.base, ficha.folio) : null;
}
