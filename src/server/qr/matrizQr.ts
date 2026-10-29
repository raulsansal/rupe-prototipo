import "server-only";
// Matriz de módulos del QR de la ficha (librería qrcode, HU 021). Corrección M (15 %): la URL mide ~60 a 70 caracteres (versión 4 a 5, 33 a 37 módulos); un nivel más alto
// obligaría a módulos más chicos al imprimir. La imagen del QR NO se almacena: se calcula al momento a partir de la URL. La zona de silencio (4 módulos) la dibuja quien lo pinta.
import QRCode from "qrcode";

export type MatrizQr = { modulos: number; version: number; filas: boolean[][] };

/** Calcula la matriz del QR de `url`. Lanza si el texto no cabe (no ocurre con las URL de la ficha). */
export function matrizQr(url: string): MatrizQr {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const filas = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.modules.get(x, y) === 1));
  return { modulos: n, version: qr.version, filas };
}

/** URL que lleva el QR: SOLO la ficha pública por token (nunca datos de la persona tutora). */
export const urlDelQr = (base: string, token: string) => `${base}/ficha/${token}`;
/** Enlace que se comparte: lleva el FOLIO (no el token), para que no se invalide al regenerar el QR. */
export const urlParaCompartir = (base: string, folio: string) => `${base}/ficha/${folio}`;
/** Enlace público de consulta de ESTATUS (HU 046): lleva el FOLIO, nunca el token ni datos de la persona tutora. */
export const urlDeEstatus = (base: string, folio: string) => `${base}/estatus/${folio}`;
