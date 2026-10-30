// HU 049 a 052 (P6b): reglas de los catálogos del Administrador, del lado del servidor. Funciones PURAS sobre filas ya leídas: el repositorio las llama DENTRO de su transacción, de modo que la
// unicidad, los protegidos y «la última opción activa» se comprueban sobre el estado vigente y dos peticiones simultáneas no pueden intercalarse (la segunda ve el estado nuevo y recibe 409).
// R34: nombre, clave y descripción se sanean antes de validarse y guardarse. Las reglas por catálogo (longitudes, protegidos…) vienen de `config/catalogos.ts`.
import { LONGITUD_DESCRIPCION, PATRON_CLAVE, type ReglasCatalogo } from "../../config/catalogos";
import { conflictoDeEstado, ErrorApp, validacion } from "../errores";

/** Vista común de una fila de cualquiera de los cuatro catálogos. */
export type FilaCatalogo = { id: number; nombre: string; clave: string | null; idCategoria?: number; descripcion?: string; activo: boolean };
/** Lo que el Administrador captura (ya saneado y con el formato validado). */
export type DatosCatalogo = { nombre: string; clave?: string; idCategoria?: number; descripcion?: string; activo?: boolean };
export type CategoriaDeCatalogo = { id: number; nombre: string };

/** R34: sin etiquetas ni caracteres de control, espacios recortados y colapsados. */
export function sanearTextoCatalogo(texto: string): string {
  return texto.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
}

/** Para la unicidad: sin acentos, sin distinguir mayúsculas ni espacios de más. */
export const normalizarNombre = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const femenino = (r: ReglasCatalogo) => r.femenino;
export const etiquetaEstatus = (r: ReglasCatalogo, activo: boolean) => (activo ? (femenino(r) ? "Activa" : "Activo") : femenino(r) ? "Inactiva" : "Inactivo");

export const errorValorProtegido = (r: ReglasCatalogo) =>
  conflictoDeEstado("VALOR_PROTEGIDO", `${femenino(r) ? "Esta" : "Este"} ${r.singular} es un valor protegido: no puede desactivarse ni eliminarse.`, "R9");
export const errorUltimaActivaDeCategoria = (categoria: string | undefined) =>
  conflictoDeEstado("ULTIMA_ACTIVA_DE_CATEGORIA", `Es la última opción activa de «${categoria ?? "su categoría"}»: cada categoría conserva al menos una.`, "R9");
/** EXTENSIÓN (no pedida por las HU 049-052): sin alcaldías oficiales activas no se podría registrar ningún caso. */
export const errorUltimaAlcaldiaActiva = () =>
  conflictoDeEstado("ULTIMA_ALCALDIA_ACTIVA", "Es la última alcaldía oficial activa: sin ella no se podría registrar ningún caso. Activa otra antes de desactivarla.", "R9");
export const errorYaDesactivado = (r: ReglasCatalogo) => conflictoDeEstado("YA_DESACTIVADO", `${femenino(r) ? "La" : "El"} ${r.singular} ya está ${femenino(r) ? "desactivada" : "desactivado"}.`);

/**
 * Formato de lo capturado (422 por campo, antes de mirar el catálogo). `actual` es la fila que se edita (undefined en un alta). Devuelve los datos saneados; los campos que el catálogo no usa se descartan.
 * `activo` solo se lee en una edición.
 */
export function leerDatosCatalogo(r: ReglasCatalogo, entrada: unknown, categorias: readonly CategoriaDeCatalogo[], actual?: FilaCatalogo): DatosCatalogo {
  const campos: Record<string, string> = {};
  const e = typeof entrada === "object" && entrada !== null && !Array.isArray(entrada) ? (entrada as Record<string, unknown>) : {};
  const texto = (v: unknown) => (typeof v === "string" ? sanearTextoCatalogo(v) : undefined);
  const salida: DatosCatalogo = { nombre: "" };

  const nombre = texto(e.nombre);
  if (!nombre) campos.nombre = "Escribe el nombre.";
  else if (nombre.length > r.longitudNombre) campos.nombre = `El nombre no puede pasar de ${r.longitudNombre} caracteres.`;
  else salida.nombre = nombre;

  if (r.conClave && !(actual && r.protegidos.includes(actual.id))) {
    const clave = texto(e.clave);
    if (!clave) campos.clave = "Escribe la clave geoestadística.";
    else if (!PATRON_CLAVE.test(clave)) campos.clave = "La clave debe tener 5 dígitos y empezar con 09 (por ejemplo, 09010).";
    else salida.clave = clave;
  }
  if (r.conCategoria) {
    const id = typeof e.idCategoria === "number" ? e.idCategoria : typeof e.idCategoria === "string" && /^\d{1,9}$/.test(e.idCategoria) ? Number(e.idCategoria) : undefined;
    if (id === undefined) campos.idCategoria = "Elige una categoría.";
    else if (!categorias.some((c) => c.id === id)) campos.idCategoria = "Elige una de las categorías de la lista.";
    else salida.idCategoria = id;
  }
  if (r.conDescripcion) {
    const descripcion = texto(e.descripcion);
    const maximo = r.longitudDescripcion ?? LONGITUD_DESCRIPCION;
    if (!descripcion) campos.descripcion = "Escribe la descripción.";
    else if (descripcion.length > maximo) campos.descripcion = `La descripción no puede pasar de ${maximo} caracteres.`;
    else salida.descripcion = descripcion;
  }
  if (actual && e.activo !== undefined) {
    if (typeof e.activo !== "boolean") campos.activo = "El estatus no es válido.";
    else salida.activo = e.activo;
  }
  if (Object.keys(campos).length) throw validacion(campos);
  return salida;
}

/** 409 por nombre o clave repetidos (dentro de la transacción, sobre las filas vigentes). */
export function comprobarUnicidad(r: ReglasCatalogo, filas: readonly FilaCatalogo[], d: DatosCatalogo, idActual?: number): void {
  const otras = filas.filter((f) => f.id !== idActual);
  if (otras.some((f) => normalizarNombre(f.nombre) === normalizarNombre(d.nombre))) {
    const m = `Ya existe ${femenino(r) ? "una" : "un"} ${r.singular} con ese nombre.`;
    throw new ErrorApp(409, "NOMBRE_DUPLICADO", m, "R9", { nombre: m });
  }
  if (d.clave && otras.some((f) => f.clave === d.clave)) throw new ErrorApp(409, "CLAVE_DUPLICADA", "Esa clave ya está en uso.", "R9", { clave: "Esa clave ya está en uso." });
}

/** Motivo por el que una fila activa NO puede quedar desactivada (o dejar su categoría), o undefined si puede. Dentro de la transacción. */
export function impedimentoParaDesactivar(r: ReglasCatalogo, filas: readonly FilaCatalogo[], f: FilaCatalogo, categorias: readonly CategoriaDeCatalogo[]): ErrorApp | undefined {
  if (r.protegidos.includes(f.id)) return errorValorProtegido(r);
  if (r.conservaUnaActivaPorCategoria && f.idCategoria !== undefined && !filas.some((x) => x.id !== f.id && x.activo && x.idCategoria === f.idCategoria)) return errorUltimaActivaDeCategoria(categorias.find((c) => c.id === f.idCategoria)?.nombre);
  if (r.conservaUnaOficialActiva && !filas.some((x) => x.id !== f.id && x.activo && !r.protegidos.includes(x.id))) return errorUltimaAlcaldiaActiva();
  return undefined;
}

export type PlanDeEdicion = { sinCambios: boolean; nueva: FilaCatalogo; detalle: string; reactiva: boolean };

/**
 * Edición (con la reactivación): qué cambia, el resultado y el detalle de bitácora «anterior → nuevo» (D4: la descripción solo dice «modificada»). Una edición no desactiva (para eso está
 * `desactivar`): pedir `activo:false` en una fila activa da 422. Mover a OTRA categoría la última opción activa de una categoría protegida por la regla da 409.
 */
export function planearEdicion(r: ReglasCatalogo, filas: readonly FilaCatalogo[], actual: FilaCatalogo, d: DatosCatalogo, categorias: readonly CategoriaDeCatalogo[]): PlanDeEdicion {
  if (d.activo === false && actual.activo) throw validacion({ activo: "Para desactivar usa la acción «Desactivar»." });
  comprobarUnicidad(r, filas, d, actual.id);
  const protegida = r.protegidos.includes(actual.id);
  const nueva: FilaCatalogo = {
    ...actual,
    nombre: d.nombre,
    ...(r.conClave && !protegida ? { clave: d.clave! } : {}),
    ...(r.conCategoria ? { idCategoria: d.idCategoria! } : {}),
    ...(r.conDescripcion ? { descripcion: d.descripcion! } : {}),
    activo: d.activo ?? actual.activo,
  };
  if (actual.activo && r.conservaUnaActivaPorCategoria && nueva.idCategoria !== actual.idCategoria && !filas.some((x) => x.id !== actual.id && x.activo && x.idCategoria === actual.idCategoria))
    throw errorUltimaActivaDeCategoria(categorias.find((c) => c.id === actual.idCategoria)?.nombre);
  const reactiva = !actual.activo && nueva.activo;
  const nombreDe = (id: number | undefined) => categorias.find((c) => c.id === id)?.nombre ?? String(id);
  const partes: string[] = [];
  if (nueva.nombre !== actual.nombre) partes.push(`nombre: «${actual.nombre}» → «${nueva.nombre}»`);
  if (r.conClave && nueva.clave !== actual.clave) partes.push(`clave: ${actual.clave ?? "sin clave"} → ${nueva.clave}`);
  if (r.conCategoria && nueva.idCategoria !== actual.idCategoria) partes.push(`categoría: «${nombreDe(actual.idCategoria)}» → «${nombreDe(nueva.idCategoria)}»`);
  if (r.conDescripcion && nueva.descripcion !== actual.descripcion) partes.push("descripción modificada");
  const estatus = `${etiquetaEstatus(r, false)} → ${etiquetaEstatus(r, true)}`;
  if (reactiva) partes.push(partes.length ? `estatus: ${estatus}` : estatus);
  return { sinCambios: partes.length === 0, nueva, detalle: partes.join("; "), reactiva };
}

/** Detalle de bitácora de un alta (el nombre, como la bitácora sembrada) y de una desactivación. */
export const detalleDeAlta = (d: DatosCatalogo) => d.nombre;
export const detalleDeDesactivacion = (r: ReglasCatalogo) => `${etiquetaEstatus(r, true)} → ${etiquetaEstatus(r, false)}`;

