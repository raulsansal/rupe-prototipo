// Reglas de los catálogos del Administrador (HU 049 a 052, R9 del diccionario). Funciones puras: la interfaz solo las aplica.
import type { ConfigCatalogo, ElementoCatalogo } from "../mocks/catalogosAdmin";

export const PATRON_CLAVE = /^09[0-9]{3}$/;

export const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const esProtegido = (cfg: ConfigCatalogo, e: ElementoCatalogo) => cfg.protegidos.includes(e.id);

/** R9: cada categoría de los estados del animal conserva al menos una opción activa. */
export function esUltimaActivaDeCategoria(cfg: ConfigCatalogo, items: readonly ElementoCatalogo[], e: ElementoCatalogo): boolean {
  if (!cfg.conservaUnaActivaPorCategoria || !e.activo || e.idCategoria === undefined) return false;
  return items.filter((x) => x.activo && x.idCategoria === e.idCategoria).length === 1;
}

/** Motivo por el que un elemento NO puede desactivarse (o undefined si puede). Se muestra junto a la acción deshabilitada. */
export function motivoNoDesactivable(cfg: ConfigCatalogo, items: readonly ElementoCatalogo[], e: ElementoCatalogo): string | undefined {
  if (esProtegido(cfg, e)) return "Valor protegido: no puede desactivarse ni eliminarse.";
  if (esUltimaActivaDeCategoria(cfg, items, e)) {
    const categoria = cfg.categorias.find((c) => c.id === e.idCategoria)?.nombre;
    return `Última opción activa de «${categoria}»: cada categoría conserva al menos una.`;
  }
  return undefined;
}

export type DatosCatalogo = { nombre: string; clave: string; idCategoria: string; descripcion: string; activo: boolean };
export type ErroresCatalogo = Partial<Record<"nombre" | "clave" | "idCategoria" | "descripcion" | "activo", string>>;

/** Valida el alta o la edición (MOD-11). `actual` es el elemento que se edita; undefined en un alta. */
export function validarCatalogo(cfg: ConfigCatalogo, items: readonly ElementoCatalogo[], d: DatosCatalogo, actual?: ElementoCatalogo): ErroresCatalogo {
  const e: ErroresCatalogo = {};
  const nombre = d.nombre.trim();
  if (!nombre) e.nombre = "Escribe el nombre.";
  else if (nombre.length > cfg.longitudNombre) e.nombre = `El nombre no puede pasar de ${cfg.longitudNombre} caracteres.`;
  else if (items.some((x) => x.id !== actual?.id && normalizar(x.nombre) === normalizar(nombre))) e.nombre = `Ya existe ${cfg.femenino ? "una" : "un"} ${cfg.singular} con ese nombre.`;

  if (cfg.conClave && !(actual && cfg.protegidos.includes(actual.id))) {
    const clave = d.clave.trim();
    if (!clave) e.clave = "Escribe la clave geoestadística.";
    else if (!PATRON_CLAVE.test(clave)) e.clave = "La clave debe tener 5 dígitos y empezar con 09 (por ejemplo, 09010).";
    else if (items.some((x) => x.id !== actual?.id && x.clave === clave)) e.clave = "Esa clave ya está en uso.";
  }
  if (cfg.conCategoria) {
    if (!d.idCategoria) e.idCategoria = "Elige una categoría.";
    else if (actual && cfg.conservaUnaActivaPorCategoria && Number(d.idCategoria) !== actual.idCategoria && esUltimaActivaDeCategoria(cfg, items, actual)) e.idCategoria = "Es la última opción activa de su categoría: no puede cambiarse de categoría.";
  }
  if (cfg.conDescripcion) {
    const descripcion = d.descripcion.trim();
    if (!descripcion) e.descripcion = "Escribe la descripción.";
    else if (descripcion.length > (cfg.longitudDescripcion ?? 255)) e.descripcion = `La descripción no puede pasar de ${cfg.longitudDescripcion ?? 255} caracteres.`;
  }
  if (actual && !d.activo && actual.activo) {
    const motivo = motivoNoDesactivable(cfg, items, actual);
    if (motivo) e.activo = motivo;
  }
  return e;
}

/** Aplica un alta (actual undefined) o una edición y devuelve la lista nueva. Editar un elemento desactivado y pasarlo a Activa lo reactiva (R9). */
export function guardarElemento(cfg: ConfigCatalogo, items: readonly ElementoCatalogo[], d: DatosCatalogo, actual?: ElementoCatalogo): ElementoCatalogo[] {
  const base: Omit<ElementoCatalogo, "id"> = {
    nombre: d.nombre.trim(),
    ...(cfg.conClave && !(actual && cfg.protegidos.includes(actual.id)) ? { clave: d.clave.trim() } : {}),
    ...(cfg.conCategoria ? { idCategoria: Number(d.idCategoria) } : {}),
    ...(cfg.conDescripcion ? { descripcion: d.descripcion.trim() } : {}),
    activo: actual && cfg.protegidos.includes(actual.id) ? true : d.activo,
  };
  if (!actual) return [...items, { id: Math.max(0, ...items.map((x) => x.id)) + 1, ...base }];
  return items.map((x) => (x.id === actual.id ? { ...x, ...base } : x));
}

export function desactivarElemento(cfg: ConfigCatalogo, items: readonly ElementoCatalogo[], id: number): ElementoCatalogo[] {
  const e = items.find((x) => x.id === id);
  if (!e || motivoNoDesactivable(cfg, items, e)) throw new Error("Este elemento no puede desactivarse");
  return items.map((x) => (x.id === id ? { ...x, activo: false } : x));
}
