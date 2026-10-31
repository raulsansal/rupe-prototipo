// Token público del QR de un caso SEMBRADO, obtenido como lo haría la persona dueña: inicia sesión con su cuenta y lee el QR de la pantalla de su ficha (/tutor/casos/<folio>/ficha, SVG real),
// lo decodifica con jsQR y toma el token de la URL (<base>/ficha/<token>). Los tokens sembrados son aleatorios en cada arranque: ningún script puede derivarlos del folio.
import { CASOS_ORIGEN } from "../../src/mocks/casos";
import { CASOS_MODERACION } from "../../src/mocks/moderacion";
import { decodificarQr, rasterizarMatriz } from "../../src/server/pruebas/pdf";
import { JPEG_REAL } from "../../src/server/pruebas/imagenes";
import { alReiniciar, fetchComo, type RolPrueba } from "../sesion-pruebas";

const cache = new Map<string, string>();
let baseActual = "";
// Reiniciar los datos genera tokens nuevos: se olvidan y, si el script los había precargado, se vuelven a leer (ya con sesiones nuevas).
alReiniciar.push(async (base) => {
  cache.clear();
  if (base === baseActual) await tokensSembrados(base);
});

/** Folios de los casos sembrados (los 12 de la ficha del Administrador). */
export const FOLIOS_SEMBRADOS: readonly string[] = CASOS_MODERACION.map((c) => c.folio);
/** Quién es la dueña de un caso sembrado: los del maquetado original son de la persona tutora 1; los de moderación, de la 2 (como en el seed). */
export const duenaDe = (folio: string): RolPrueba => (FOLIOS_SEMBRADOS.includes(folio) && !CASOS_ORIGEN.some((c) => c.folio === folio) ? "tutor2" : "tutor1"); // un caso creado por el script lo crea la persona tutora 1

/** URL que lleva el QR que muestra la pantalla de la ficha de la dueña (undefined si la pantalla no trae QR). */
export async function urlDelQrDe(base: string, folio: string, rol: RolPrueba = duenaDe(folio)): Promise<string | undefined> {
  const html = await (await fetchComo(base, rol, `/tutor/casos/${folio}/ficha`)).text();
  const desde = html.indexOf("Código QR");
  const vb = /<svg[^>]*aria-label="Código QR[^"]*"[^>]*viewBox="0 0 (\d+) \d+"/.exec(html) ?? /viewBox="0 0 (\d+) \d+"[^>]*aria-label="Código QR/.exec(html);
  const d = desde < 0 ? undefined : /<path d="(M[^"]+)"/.exec(html.slice(desde))?.[1];
  if (!vb || !d) return undefined;
  const n = Number(vb[1]) - 8;
  const filas = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < Number(m[3]); i++) filas[Number(m[2]) - 4][Number(m[1]) - 4 + i] = true;
  return decodificarQr(rasterizarMatriz(filas, 8))?.texto;
}

/** Token vigente del QR del caso (con caché hasta `reiniciarDatos` u `olvidarTokens`). Lanza si la pantalla no lo entrega. */
export async function tokenDeFicha(base: string, folio: string, rol: RolPrueba = duenaDe(folio)): Promise<string> {
  const clave = `${base}|${folio}`;
  const guardado = cache.get(clave);
  if (guardado) return guardado;
  const token = /\/ficha\/([A-Za-z0-9]{32})$/.exec((await urlDelQrDe(base, folio, rol)) ?? "")?.[1];
  if (!token) throw new Error(`No se pudo leer el token del QR de ${folio} en la pantalla de su dueña.`);
  cache.set(clave, token);
  return token;
}

/** Lee y guarda los 12 tokens vigentes de `base` para poder consultarlos de forma síncrona con `tokenSembrado`. Llamarlo tras arrancar o reiniciar los datos. */
export async function precargarTokens(base: string): Promise<void> {
  baseActual = base;
  await tokensSembrados(base);
}
/** Token vigente ya leído con `precargarTokens` (síncrono). Lanza si no se precargó. */
export function tokenSembrado(folio: string): string {
  const t = cache.get(`${baseActual}|${folio}`);
  if (!t) throw new Error(`Sin token para ${folio}: o no se llamó a precargarTokens(base), o el caso ya no está «En curso» y su dueña no ve el QR (no hay vía real que lo entregue).`);
  return t;
}

/**
 * Los tokens vigentes que la persona dueña PUEDE ver. Solo los casos «En curso» muestran su QR (la ficha de un caso Localizado, Cerrado, Cancelado o Deshabilitado
 * responde «no está disponible»), así que de los 12 sembrados solo se leen los que siguen en curso; para el resto no existe vía real (ver `tokenSembrado`).
 */
export async function tokensSembrados(base: string): Promise<string[]> {
  const leidos: string[] = [];
  for (const f of FOLIOS_SEMBRADOS) {
    const t = await tokenDeFichaOpcional(base, f);
    if (t) leidos.push(t);
  }
  return leidos;
}

async function tokenDeFichaOpcional(base: string, folio: string): Promise<string | undefined> {
  try {
    return await tokenDeFicha(base, folio);
  } catch {
    return undefined;
  }
}

/** Olvida los tokens leídos: llamarlo tras regenerar un QR (el anterior deja de ser el vigente). */
export const olvidarTokens = () => cache.clear();

/** Los tokens ya precargados (síncrono): lista de «secretos» que no deben aparecer donde no corresponde. Solo los de casos con QR visible. */
export const tokensPrecargados = (): string[] => FOLIOS_SEMBRADOS.flatMap((f) => cache.get(`${baseActual}|${f}`) ?? []);

/** ¿Se pudo leer el token de este caso sembrado? (false: no está «En curso», no hay vía real que se lo entregue a su dueña). */
export const hayTokenDe = (folio: string): boolean => cache.has(`${baseActual}|${folio}`);

export type EstadoVivo = "En búsqueda" | "Localizado" | "Cerrado confirmado" | "Cancelado" | "Deshabilitado";
/**
 * Los casos sembrados que ya no están «En curso» no entregan su token a su dueña (no hay vía real). Para probar cómo responde el canal del QR en cada estado se CREA un caso nuevo por la vía
 * real (POST /api/casos como persona tutora 1), se lee su token mientras está en búsqueda y se lleva al estado pedido con las acciones reales de la dueña o del Administrador.
 */
export async function casoVivoEnEstado(base: string, estado: EstadoVivo): Promise<{ folio: string; token: string }> {
  const origen = new URL(base).origin;
  const f = new FormData();
  f.set("datos", JSON.stringify({ nombre: `Vivo ${estado}`, sexo: "Macho", idRaza: 1, edad: { valor: 2, unidad: "años" }, tamano: "mediano", color: "Negro", caracteristicas: "Mancha blanca", fechaExtravio: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10), momento: "noche", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle de prueba", referencias: "Frente a la plaza", idMotivo: 1, descripcion: "Caso creado por una prueba." }));
  f.set("fotografia", new Blob([JPEG_REAL as BlobPart], { type: "image/jpeg" }), "foto.jpg");
  const alta = await fetchComo(base, "tutor1", "/api/casos", { method: "POST", body: f, headers: { Origin: origen } });
  if (alta.status !== 201) throw new Error(`No se pudo crear el caso de prueba (HTTP ${alta.status}).`);
  const folio = String(((await alta.json()) as { folio: string }).folio);
  const token = await tokenDeFicha(base, folio, "tutor1"); // se lee ANTES de salir de «En búsqueda»
  const json = { "Content-Type": "application/json", Origin: origen };
  const accion = async (a: string, motivo?: string) => {
    const r = await fetchComo(base, "tutor1", `/api/casos/${folio}/estado`, { method: "POST", headers: json, body: JSON.stringify({ accion: a, motivo }) });
    if (r.status !== 200) throw new Error(`La acción «${a}» del caso de prueba dio HTTP ${r.status}.`);
  };
  if (estado === "Localizado" || estado === "Cerrado confirmado") await accion("localizar");
  if (estado === "Cerrado confirmado") await accion("cerrar");
  if (estado === "Cancelado") await accion("cancelar", "Prueba de estado.");
  if (estado === "Deshabilitado") {
    const r = await fetchComo(base, "admin", `/api/admin/registros/${folio}/moderacion`, { method: "POST", headers: json, body: JSON.stringify({ accion: "deshabilitar", motivo: "Prueba de estado." }) });
    if (r.status !== 200) throw new Error(`Deshabilitar el caso de prueba dio HTTP ${r.status}.`);
  }
  return { folio, token };
}
