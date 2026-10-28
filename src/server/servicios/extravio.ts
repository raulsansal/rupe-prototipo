import "server-only";
// F2 «Registrar extravío» (HU 011, 012 y 013). La guarda de sesión, rol y dueño va AQUÍ, dentro del servicio (no en el layout ni en el proxy). El dueño sale SIEMPRE
// de la sesión. R6: el caso, el perro, la fotografía, el QR inicial y los movimientos «registro» y «ficha generada» se crean en UNA transacción, de modo que el caso queda
// en «En búsqueda» (E1; «Extraviado» es un estado instantáneo). R24 no aplica: la bitácora solo registra acciones administrativas.
import { ahoraUTC, hoyCDMX } from "../dominio/fechas";
import { LADO_MAXIMO_CASO, prepararImagen } from "../imagenes/prepararImagen";
import { generarFolio } from "../dominio/folio";
import { generarTokenQr } from "../dominio/qr";
import { leerDatosDeExtravio, validarExtravio } from "../dominio/caso";
import { vistaPreviaDeCorreo, type CorreoVistaPrevia } from "../dominio/correo";
import { textoDeEdad, type UnidadEdad } from "../dominio/edad";
import { estadoActual } from "../dominio/transiciones";
import { noEncontrado, reglaDeNegocio, validacion } from "../errores";
import { ConflictoDeUnicidad } from "../repos/errores";
import { exigirAccesoAlCaso, exigirRol, type SesionActual } from "../sesion/guardas";
import { normalizarFolio } from "../dominio/folio";
import { contextoPorDefecto, historialDe, idDeEstado, type Contexto } from "./contexto";

export type FotoDeEntrada = { bytes: Uint8Array; tipoDeclarado: string };
export const INTENTOS_DE_FOLIO = 10;

/** Tamaño máximo de la parte de la petición: la fotografía más un margen para los datos. */
export const MARGEN_DE_DATOS_BYTES = 64 * 1024;
export async function limiteDeCuerpo(ctx: Contexto = contextoPorDefecto()): Promise<number> {
  const mb = Math.min(Number(await ctx.repos.parametros.valor("tamano_maximo_archivo_mb")), 4.5);
  return Math.floor(mb * 1024 * 1024) + MARGEN_DE_DATOS_BYTES;
}

export async function registrarExtravio(sesion: SesionActual | undefined, entrada: { datos: unknown; foto?: FotoDeEntrada }, ctx: Contexto = contextoPorDefecto()) {
  const persona = exigirRol(sesion, "Tutor"); // 401 sin sesión, 403 con otro rol (R32: solo el rol Tutor registra perros)
  const { repos, reloj } = ctx;
  const datos = leerDatosDeExtravio(entrada.datos); // lista permitida: se ignora cualquier otro campo del cliente
  const [razas, alcaldias, motivos, maximoMb] = [await repos.catalogos.razas(), await repos.catalogos.alcaldias(), await repos.catalogos.motivos(), Number(await repos.parametros.valor("tamano_maximo_archivo_mb"))];
  const r = validarExtravio(datos, { razas, alcaldias, motivos }, { hoy: hoyCDMX(reloj), foto: entrada.foto, maximoMb });
  if (!r.validado) throw validacion(r.campos);
  const v = r.validado;
  // HU 011 regla 6: la foto se re-codifica en el SERVIDOR (orientación aplicada, lado máximo 1600 px, JPEG, sin EXIF ni ubicación) antes de guardarla. Si la cabecera es
  // válida pero la imagen no se puede leer (truncada, corrupta), se rechaza con el mismo mensaje que un archivo que no es JPG o PNG.
  let foto: { bytes: Uint8Array };
  try {
    foto = { bytes: (await prepararImagen(entrada.foto!.bytes, { tipo: "lado", maximo: LADO_MAXIMO_CASO })).bytes };
  } catch {
    throw validacion({ foto: "La fotografía debe ser JPG o PNG." });
  }
  const ahora = ahoraUTC(reloj);
  const [idExtraviado, idEnBusqueda] = [await idDeEstado(repos, "Extraviado"), await idDeEstado(repos, "En búsqueda")];
  for (let intento = 0; intento < INTENTOS_DE_FOLIO; intento++) {
    const folio = generarFolio(ctx.aleatorio);
    try {
      const caso = await repos.casos.crearConPerro({
        fotografia: { referenciaArchivo: "", formato: "JPG", tamanoBytes: foto.bytes.length, fechaCarga: ahora },
        contenidoFotografia: { tipo: "image/jpeg", bytes: foto.bytes },
        perro: { ...v.perro, idUsuario: persona.idUsuario }, // el dueño es la sesión, nunca un campo del cliente
        caso: { folio, ...v.caso, fechaRegistro: ahora, fechaUltimaModificacion: ahora },
        qr: { tokenPublico: generarTokenQr(), fechaGeneracion: ahora, fechaInvalidacion: null },
        movimientos: [
          { fechaHora: ahora, tipoMovimiento: "registro", idEstadoCaso: idExtraviado, idUsuario: null }, // E4: automáticos, sin usuario
          { fechaHora: ahora, tipoMovimiento: "ficha generada", idEstadoCaso: idEnBusqueda, idUsuario: null },
        ],
      });
      return { idCasoExtravio: caso.idCasoExtravio, folio: caso.folio, estado: "En búsqueda" as const };
    } catch (e) {
      if (e instanceof ConflictoDeUnicidad) continue; // el folio (o el token) ya existía: nada quedó guardado, se intenta con otro
      throw e;
    }
  }
  throw reglaDeNegocio("R26", "No fue posible generar un folio único. Inténtalo de nuevo.", "FOLIO_NO_GENERADO");
}

/** Bytes de una fotografía subida, solo para su dueño (o el Administrador, que únicamente la consulta). Otra tutora, id inexistente y foto sembrada responden lo MISMO (404). */
export async function fotografiaDelCaso(sesion: SesionActual | undefined, idFotografia: number, ctx: Contexto = contextoPorDefecto()) {
  exigirRol(sesion);
  const [dueno, contenido] = [await ctx.repos.casos.duenoDeFotografia(idFotografia), await ctx.repos.casos.contenidoDeFotografia(idFotografia)];
  if (dueno === undefined || !contenido) throw noEncontrado();
  exigirAccesoAlCaso(sesion, dueno, "consultar");
  return contenido;
}

export type CasoCreado = {
  folio: string; estado: string; nombreDelPerro: string; sexo: string; raza: string; tamano: string; color: string; edadTexto: string; fotoUrl: string;
  /** Aviso en la aplicación (siempre) y vista previa del correo (solo con notificaciones activas, HU 002 regla 6). */
  aviso: string; correo: CorreoVistaPrevia | null;
};

/** Lo que muestra la confirmación del registro, solo a su dueña. */
export async function casoRecienCreado(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<CasoCreado> {
  exigirRol(sesion);
  const { repos } = ctx;
  const caso = await repos.casos.porFolio(normalizarFolio(folio));
  const perro = caso && (await repos.casos.perro(caso.idPerro));
  if (!caso || !perro) throw noEncontrado();
  exigirAccesoAlCaso(sesion, perro.idUsuario, "consultar");
  const [usuario, foto, historial] = [await repos.usuarios.porId(perro.idUsuario), await repos.casos.fotografia(perro.idFotografia), await historialDe(repos, caso.idCasoExtravio)];
  const edad = { valor: perro.edadValor, unidad: perro.edadUnidad as UnidadEdad };
  return {
    folio: caso.folio, estado: estadoActual(historial) ?? "En búsqueda", nombreDelPerro: perro.nombre, sexo: perro.sexo, raza: perro.razaEspecificada ?? ((await repos.catalogos.razas()).find((r) => r.idRaza === perro.idRaza)?.nombre ?? ""), tamano: perro.tamano, color: perro.color, edadTexto: textoDeEdad(edad.valor, edad.unidad), fotoUrl: foto?.referenciaArchivo ?? "",
    aviso: `Tu folio es ${caso.folio}. También te lo avisamos aquí, en la aplicación.`,
    correo: usuario?.notificacionesActivas ? vistaPreviaDeCorreo({ nombreDeLaPersona: usuario.nombreCompleto, folio: caso.folio, nombreDelPerro: perro.nombre, edadValor: edad.valor, edadUnidad: edad.unidad }) : null,
  };
}
