import "server-only";
// Fotos de los casos sembrados (P2c): `<FOLIO>.jpg` en src/server/seed/fotos/ (se generan con `npm run preparar-fotos`). Viven FUERA de public/ para que solo las sirva
// GET /api/fotografias/[id] con su guarda (dueña o Administrador). Si el archivo falta o no es una foto válida, el caso conserva su imagen de marcador: nunca se lanza un error,
// así que ni el build, ni las pruebas, ni el CI dependen de que existan.
// LIMITACIÓN: se leen con fs desde process.cwd(); en un despliegue «standalone» o en Vercel esa carpeta no viaja sin outputFileTracingIncludes.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { detectarFormato, MAXIMO_TECNICO_MB, TIPO_MIME, type FormatoFoto } from "../dominio/fotografia";

export const CARPETA_FOTOS_SEMBRADAS = join(process.cwd(), "src", "server", "seed", "fotos");

export type FotoSembrada = { formato: FormatoFoto; tipo: string; bytes: Uint8Array };

/** Lee `<folio>.jpg` de la carpeta (inyectable en pruebas). Devuelve undefined si falta, está vacía, es demasiado grande, no es JPEG/PNG por sus bytes o el JPEG está truncado. */
export function leerFotoSembrada(carpeta: string, folio: string): FotoSembrada | undefined {
  try {
    const ruta = join(carpeta, `${folio}.jpg`);
    if (!existsSync(ruta) || statSync(ruta).size === 0 || statSync(ruta).size > MAXIMO_TECNICO_MB * 1024 * 1024) return undefined;
    const bytes = Uint8Array.from(readFileSync(ruta));
    const formato = detectarFormato(bytes);
    if (!formato) return undefined;
    if (formato === "JPG" && !(bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9)) return undefined; // sin marcador final: archivo truncado
    return { formato, tipo: TIPO_MIME[formato], bytes };
  } catch {
    return undefined;
  }
}
