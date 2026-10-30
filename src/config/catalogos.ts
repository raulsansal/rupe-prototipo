// Configuración de los catálogos que gestiona el Administrador (HU 049 a 052, R9): reglas, límites, protegidos y etiquetas. SIN DATOS: los valores
// (nombres, claves, descripciones, estatus) viven en el almacén. La comparten el dominio del servidor y las pantallas.

export type TipoCatalogo = "alcaldias" | "razas" | "motivos" | "estados-animal";
export const TIPOS_CATALOGO: readonly TipoCatalogo[] = ["alcaldias", "razas", "motivos", "estados-animal"];
export const esTipoCatalogo = (t: unknown): t is TipoCatalogo => typeof t === "string" && (TIPOS_CATALOGO as readonly string[]).includes(t);

/** Clave geoestadística de una alcaldía: 5 caracteres, `09` + 3 dígitos (diccionario: REGEXP '^09[0-9]{3}$'). */
export const PATRON_CLAVE = /^09[0-9]{3}$/;
export const LONGITUD_DESCRIPCION = 255;
/** «Fuera de la Ciudad de México»: no se desactiva, no lleva clave y no se ofrece al registrar un caso. */
export const ID_ALCALDIA_FUERA_DE_LA_CIUDAD = 17;
/** Raza «Otra» (protegida): exige especificar la raza (R8). */
export const ID_RAZA_OTRA = 14;

export type ReglasCatalogo = {
  tipo: TipoCatalogo;
  /** Etiqueta de `id_afectada` en la bitácora (`alcaldia:12`). */
  etiquetaBitacora: "alcaldia" | "raza" | "motivo" | "estado_animal";
  /** Clave del contador de ids del almacén. */
  tablaIds: "alcaldia" | "raza" | "motivo" | "estado_animal";
  ruta: string;
  titulo: string;
  /** «alcaldía», «raza», «motivo de extravío», «estado del animal». */
  singular: string;
  /** Género gramatical: «Activa/Inactiva» y «una» frente a «Activo/Inactivo» y «un». */
  femenino: boolean;
  agregar: string;
  conClave: boolean;
  conCategoria: boolean;
  conDescripcion: boolean;
  etiquetaCategoria?: string;
  /** Ids que no pueden desactivarse ni eliminarse (R9). */
  protegidos: readonly number[];
  longitudNombre: number;
  longitudDescripcion?: number;
  /** HU 052 regla 5 / R9: cada categoría conserva al menos una opción activa. */
  conservaUnaActivaPorCategoria: boolean;
  /** EXTENSIÓN (no pedida por las HU 049-052): las alcaldías oficiales (todas menos las protegidas) conservan al menos una activa; si no, el registro de un caso se quedaría sin alcaldías. */
  conservaUnaOficialActiva: boolean;
};

export const REGLAS_CATALOGO: Record<TipoCatalogo, ReglasCatalogo> = {
  alcaldias: {
    tipo: "alcaldias", etiquetaBitacora: "alcaldia", tablaIds: "alcaldia", ruta: "/admin/alcaldias", titulo: "Catálogo de alcaldías", singular: "alcaldía", femenino: true, agregar: "Agregar alcaldía",
    conClave: true, conCategoria: false, conDescripcion: false, protegidos: [ID_ALCALDIA_FUERA_DE_LA_CIUDAD], longitudNombre: 60, conservaUnaActivaPorCategoria: false, conservaUnaOficialActiva: true,
  },
  razas: {
    tipo: "razas", etiquetaBitacora: "raza", tablaIds: "raza", ruta: "/admin/razas", titulo: "Catálogo de razas", singular: "raza", femenino: true, agregar: "Agregar raza",
    conClave: false, conCategoria: false, conDescripcion: false, protegidos: [1, 14], longitudNombre: 80, conservaUnaActivaPorCategoria: false, conservaUnaOficialActiva: false,
  },
  motivos: {
    tipo: "motivos", etiquetaBitacora: "motivo", tablaIds: "motivo", ruta: "/admin/motivos", titulo: "Catálogo de motivos de extravío", singular: "motivo de extravío", femenino: false, agregar: "Agregar motivo",
    conClave: false, conCategoria: true, conDescripcion: true, etiquetaCategoria: "Categoría", protegidos: [14, 15], longitudNombre: 80, longitudDescripcion: LONGITUD_DESCRIPCION, conservaUnaActivaPorCategoria: false, conservaUnaOficialActiva: false,
  },
  "estados-animal": {
    tipo: "estados-animal", etiquetaBitacora: "estado_animal", tablaIds: "estado_animal", ruta: "/admin/estados-animal", titulo: "Catálogo de estados del animal", singular: "estado del animal", femenino: false, agregar: "Agregar estado",
    conClave: false, conCategoria: true, conDescripcion: true, etiquetaCategoria: "Categoría", protegidos: [1, 5, 6], longitudNombre: 80, longitudDescripcion: LONGITUD_DESCRIPCION, conservaUnaActivaPorCategoria: true, conservaUnaOficialActiva: false,
  },
};
