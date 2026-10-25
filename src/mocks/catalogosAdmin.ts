// Catálogos que gestiona el Administrador (HU 049 a 052): alcaldías, razas, motivos de extravío y estados del animal. Los valores iniciales
// son los del diccionario de datos (con la clave geoestadística de cada alcaldía); algunos aparecen desactivados para mostrar ese estado.
import { CATEGORIAS_ESTADO_ANIMAL, CATEGORIAS_MOTIVO, ESTADOS_ANIMAL, MOTIVOS, RAZAS } from "./catalogos";
import { ALCALDIAS, FUERA_DE_LA_CIUDAD } from "./tipos";

export type TipoCatalogo = "alcaldias" | "razas" | "motivos" | "estados-animal";

export type ElementoCatalogo = {
  id: number;
  nombre: string;
  /** Solo alcaldías: 5 caracteres (09 + 3 dígitos), única; «Fuera de la Ciudad de México» no lleva. */
  clave?: string;
  /** Solo motivos y estados del animal. */
  idCategoria?: number;
  /** Solo motivos y estados del animal. */
  descripcion?: string;
  activo: boolean;
};

export type ConfigCatalogo = {
  tipo: TipoCatalogo;
  ruta: string;
  titulo: string;
  /** «alcaldía», «raza», «motivo de extravío», «estado del animal». */
  singular: string;
  /** Género gramatical: «Activa/Inactiva» y «la/una» frente a «Activo/Inactivo». */
  femenino: boolean;
  agregar: string;
  conClave: boolean;
  conCategoria: boolean;
  conDescripcion: boolean;
  etiquetaCategoria?: string;
  categorias: readonly { id: number; nombre: string }[];
  /** Ids que no pueden desactivarse ni eliminarse (R9). */
  protegidos: readonly number[];
  longitudNombre: number;
  longitudDescripcion?: number;
  /** R9 de los estados del animal: cada categoría conserva al menos una opción activa. */
  conservaUnaActivaPorCategoria: boolean;
  elementos: readonly ElementoCatalogo[];
};

const CLAVES: Record<string, string> = {
  "Álvaro Obregón": "09010", Azcapotzalco: "09002", "Benito Juárez": "09014", Coyoacán: "09003", "Cuajimalpa de Morelos": "09004", Cuauhtémoc: "09015",
  "Gustavo A. Madero": "09005", Iztacalco: "09006", Iztapalapa: "09007", "La Magdalena Contreras": "09008", "Miguel Hidalgo": "09016", "Milpa Alta": "09009",
  Tláhuac: "09011", Tlalpan: "09012", "Venustiano Carranza": "09017", Xochimilco: "09013",
};

/** Demostraciones del estado «Inactiva»: no cambian los catálogos que usan los formularios de la maqueta. */
const INACTIVAS = { alcaldias: [12], razas: [6], motivos: [2], "estados-animal": [16, 17] } as const;
const activo = (tipo: TipoCatalogo, id: number) => !(INACTIVAS[tipo] as readonly number[]).includes(id);

export const CATALOGOS: Record<TipoCatalogo, ConfigCatalogo> = {
  alcaldias: {
    tipo: "alcaldias", ruta: "/admin/alcaldias", titulo: "Catálogo de alcaldías", singular: "alcaldía", femenino: true, agregar: "Agregar alcaldía",
    conClave: true, conCategoria: false, conDescripcion: false, categorias: [], protegidos: [17], longitudNombre: 60, conservaUnaActivaPorCategoria: false,
    elementos: [...ALCALDIAS.map((nombre, i) => ({ id: i + 1, nombre, clave: CLAVES[nombre], activo: activo("alcaldias", i + 1) })), { id: 17, nombre: FUERA_DE_LA_CIUDAD, activo: true }],
  },
  razas: {
    tipo: "razas", ruta: "/admin/razas", titulo: "Catálogo de razas", singular: "raza", femenino: true, agregar: "Agregar raza",
    conClave: false, conCategoria: false, conDescripcion: false, categorias: [], protegidos: [1, 14], longitudNombre: 80, conservaUnaActivaPorCategoria: false,
    elementos: RAZAS.map((r) => ({ id: r.id, nombre: r.nombre, activo: activo("razas", r.id) })),
  },
  motivos: {
    tipo: "motivos", ruta: "/admin/motivos", titulo: "Catálogo de motivos de extravío", singular: "motivo de extravío", femenino: false, agregar: "Agregar motivo",
    conClave: false, conCategoria: true, conDescripcion: true, etiquetaCategoria: "Categoría", categorias: CATEGORIAS_MOTIVO, protegidos: [14, 15], longitudNombre: 80, longitudDescripcion: 255, conservaUnaActivaPorCategoria: false,
    elementos: MOTIVOS.map((m) => ({ id: m.id, nombre: m.nombre, idCategoria: m.idCategoria, descripcion: m.descripcion, activo: activo("motivos", m.id) })),
  },
  "estados-animal": {
    tipo: "estados-animal", ruta: "/admin/estados-animal", titulo: "Catálogo de estados del animal", singular: "estado del animal", femenino: false, agregar: "Agregar estado",
    conClave: false, conCategoria: true, conDescripcion: true, etiquetaCategoria: "Categoría", categorias: CATEGORIAS_ESTADO_ANIMAL.map((c) => ({ id: c.id, nombre: c.nombre })), protegidos: [1, 5, 6], longitudNombre: 80, longitudDescripcion: 255, conservaUnaActivaPorCategoria: true,
    elementos: ESTADOS_ANIMAL.map((e) => ({ id: e.id, nombre: e.nombre, idCategoria: e.idCategoria, descripcion: e.descripcion, activo: activo("estados-animal", e.id) })),
  },
};

export const TIPOS_CATALOGO = Object.keys(CATALOGOS) as TipoCatalogo[];

if (process.env.NODE_ENV !== "production") {
  for (const c of Object.values(CATALOGOS)) {
    const ids = new Set(c.elementos.map((e) => e.id));
    if (ids.size !== c.elementos.length) throw new Error(`${c.titulo}: ids duplicados`);
    for (const p of c.protegidos) if (!c.elementos.find((e) => e.id === p)?.activo) throw new Error(`${c.titulo}: el valor protegido ${p} debe existir y estar activo`);
    if (c.conservaUnaActivaPorCategoria) for (const cat of c.categorias) if (!c.elementos.some((e) => e.idCategoria === cat.id && e.activo)) throw new Error(`${c.titulo}: la categoría ${cat.nombre} no tiene opciones activas`);
  }
}

export type AperturaCatalogo = { accion: "editar" | "desactivar"; id: number } | { accion: "nuevo" };

/** Modal de ejemplo de cada variante de captura: el primer elemento activo que no es protegido (en los estados del animal, de «Contención y ubicación»). */
export function aperturaDeEjemplo(tipo: TipoCatalogo, modal: string | string[] | undefined): AperturaCatalogo | undefined {
  if (modal === "nuevo") return { accion: "nuevo" };
  if (modal !== "editar" && modal !== "desactivar") return undefined;
  const c = CATALOGOS[tipo];
  const ejemplo = c.elementos.find((e) => e.activo && !c.protegidos.includes(e.id) && (!c.conservaUnaActivaPorCategoria || e.idCategoria === 2))!;
  return { accion: modal, id: ejemplo.id };
}
