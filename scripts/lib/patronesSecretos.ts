// Patrones que NO deben aparecer en el código que viaja al navegador (.next/static). Módulo aparte para poder probarlo (patronesSecretos.test.ts).

/**
 * ÚNICA excepción: el NOMBRE de esta variable puede verse en el navegador porque la interfaz lo cita en el aviso «Configura RUPE_URL_PUBLICA para generar el QR.» (es configuración
 * pública, no un secreto). La excepción es EXACTA: un nombre que la contenga como prefijo (RUPE_URL_PUBLICA_SECRETO, RUPE_URL_PUBLICA2…) sigue detectándose, y también
 * cualquier asignación con valor (RUPE_URL_PUBLICA=…, RUPE_URL_PUBLICA: "…") o su lectura con process.env: su VALOR solo lo lee el servidor.
 */
export const NOMBRE_EXCEPTUADO = "RUPE_URL_PUBLICA";
const sufijo = NOMBRE_EXCEPTUADO.slice("RUPE_".length);

export const PROHIBIDOS: { patron: RegExp; porQue: string }[] = [
  { patron: new RegExp(`RUPE_(?!${sufijo}(?![A-Za-z0-9_]))[A-Z0-9_]{3,}`), porQue: "nombre de variable de entorno del servidor (RUPE_SESION_SECRETO, contraseñas, RUPE_PERMITIR_REINICIO…)" },
  { patron: new RegExp(`${NOMBRE_EXCEPTUADO}(?![A-Za-z0-9_])\\s*[:=]\\s*["'\`]?[^\\s"'\`,;)}]`), porQue: "una variable de entorno con valor asignado" },
  { patron: new RegExp(`process\\.env\\.${NOMBRE_EXCEPTUADO}(?![A-Za-z0-9_])`), porQue: "lectura de una variable de entorno del servidor desde el navegador" },
  { patron: /__RUPE_ALMACEN__/, porQue: "singleton del almacén en memoria" },
  { patron: /contrasenaHash|tokenHash|intentosFallidos|bloqueadoHasta/, porQue: "columnas de usuarios y sesiones (solo existen en el servidor)" },
  { patron: /crearRepositorios|reiniciarAlmacen|obtenerAlmacen|siguienteId/, porQue: "código del almacén y de los repositorios" },
  { patron: /\bhashSync\b|\bbcryptjs\b|createHmac|timingSafeEqual/, porQue: "código de contraseñas y firma de sesión" },
];

/** Hallazgos de un texto: [coincidencia, motivo]. */
export function hallazgosEn(texto: string): [string, string][] {
  return PROHIBIDOS.flatMap(({ patron, porQue }) => {
    const m = texto.match(patron);
    return m ? [[m[0], porQue] as [string, string]] : [];
  });
}
