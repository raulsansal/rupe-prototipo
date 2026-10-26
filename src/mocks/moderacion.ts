// Datos ficticios de la moderación del Administrador (ADM-04 y ADM-05). El administrador consulta TODOS los casos del sistema, pero
// no ve datos de las personas tutoras: aquí solo hay datos del perro y del extravío (nunca nombre, correo ni teléfono).
import { aCasoTutor, CASOS_ORIGEN, construirHistorial } from "./casos";
import { AVISTAMIENTOS, FOTO_SENSIBLE, esFallecido, type AvistamientoRecibido } from "./avistamientos";
import type { CasoTutor, MovimientoHistorial } from "./tipos";

const FOTO = "/mocks/perro-ejemplo.svg";

type Extra = Omit<CasoTutor, "historial" | "estado"> & { historial: MovimientoHistorial[] };
const conEstado = (e: Extra): CasoTutor => ({ ...e, estado: e.historial[e.historial.length - 1].estado });

const mov = (h: MovimientoHistorial[], m: Omit<MovimientoHistorial, "consecutivo">): MovimientoHistorial[] => [...h, { ...m, consecutivo: h.length + 1 }];

/** Casos de otras personas tutoras que solo existen en la moderación (no tienen ficha pública ni pantalla de la persona tutora). */
const EXTRAS: CasoTutor[] = [
  // Cerrado por deshabilitación del Administrador: se puede restaurar y vuelve a «En búsqueda».
  conEstado({
    nombre: "Kira", sexo: "Hembra", raza: "Husky Siberiano (Siberian Husky)", edadValor: 3, edadUnidad: "años", tamano: "grande", color: "Gris con blanco", fotografiaUrl: FOTO,
    folio: "RUPE-D5W2QK8X", fechaRegistro: "2026-10-11T15:30:00Z", fechaExtravio: "2026-10-11", momentoDelDia: "tarde", coloniaZona: "Doctores", alcaldia: "Cuauhtémoc", motivo: "Portones o puertas abiertas",
    direccionAproximada: "Calle Reservada 61, esquina Cruce Oculto", referenciasDelLugar: "Referencia reservada: junto a la panadería", descripcionCircunstancias: "Descripción reservada: el portón quedó abierto al salir.",
    historial: mov(construirHistorial("En búsqueda", "2026-10-11T15:30:00Z"), { tipo: "deshabilitación", estado: "Cerrado", fechaHora: "2026-10-13T20:05:00Z", motivo: "La fotografía no corresponde a un perro extraviado: es una imagen tomada de internet." }),
  }),
  // Cerrado por cancelación de la persona tutora: ni se deshabilita ni se restaura.
  conEstado({
    nombre: "Simba", sexo: "Macho", raza: "Pug (Carlino)", edadValor: 2, edadUnidad: "años", tamano: "pequeño", color: "Beige", fotografiaUrl: FOTO,
    folio: "RUPE-F7L3MN6Y", fechaRegistro: "2026-10-08T12:10:00Z", fechaExtravio: "2026-10-08", momentoDelDia: "mañana", coloniaZona: "Agrícola Oriental", alcaldia: "Iztacalco", motivo: "Equipo de sujeción defectuoso",
    direccionAproximada: "Avenida Reservada 210", referenciasDelLugar: "Referencia reservada: frente al deportivo", descripcionCircunstancias: "Descripción reservada: se zafó del collar.",
    historial: mov(construirHistorial("En búsqueda", "2026-10-08T12:10:00Z"), { tipo: "cancelación", estado: "Cerrado", fechaHora: "2026-10-09T16:40:00Z", motivo: "Mi perro regresó solo a casa." }),
  }),
  // Dos casos más en curso, para que la lista tenga varias páginas y alcaldías distintas.
  conEstado({
    nombre: "Duque", sexo: "Macho", raza: "Poodle (Caniche)", edadValor: 9, edadUnidad: "años", tamano: "pequeño", color: "Caramelo", fotografiaUrl: FOTO,
    folio: "RUPE-G8R4TV3K", fechaRegistro: "2026-10-16T09:20:00Z", fechaExtravio: "2026-10-16", momentoDelDia: "mañana", coloniaZona: "Tepepan", alcaldia: "Xochimilco", motivo: "Curiosidad o aburrimiento",
    direccionAproximada: "Calle Reservada 14", referenciasDelLugar: "Referencia reservada: cerca del embarcadero", descripcionCircunstancias: "Descripción reservada: salió por un hueco de la barda.",
    historial: construirHistorial("En seguimiento", "2026-10-16T09:20:00Z"),
  }),
  conEstado({
    nombre: "Mia", sexo: "Hembra", raza: "Mestizo/No identificada", edadValor: 1, edadUnidad: "años", tamano: "mediano", color: "Caramelo", fotografiaUrl: FOTO,
    folio: "RUPE-J2C6PZ9H", fechaRegistro: "2026-10-17T18:45:00Z", fechaExtravio: "2026-10-17", momentoDelDia: "noche", coloniaZona: "Pedregal de San Nicolás", alcaldia: "Tlalpan", motivo: "Pánico por ruidos fuertes",
    direccionAproximada: "Calle Reservada 99", referenciasDelLugar: "Referencia reservada: atrás de la escuela", descripcionCircunstancias: "Descripción reservada: huyó por la pirotecnia.",
    historial: construirHistorial("En búsqueda", "2026-10-17T18:45:00Z"),
  }),
];

/**
 * Lo que el Administrador ve en el DETALLE de un caso (HU 016: todos los campos del perro y del extravío, en solo lectura; lámina 2.5) más
 * el historial de estados. Es una lista permitida de campos: nunca lleva datos de la persona tutora (nombre, correo, teléfono, identificadores
 * de usuario) ni el token del QR, para que ni siquiera viajen en la página.
 */
export type RegistroAdmin = Pick<
  CasoTutor,
  | "folio" | "nombre" | "sexo" | "raza" | "razaEspecificada" | "edadValor" | "edadUnidad" | "tamano" | "color" | "caracteristicasDistintivas" | "fotografiaUrl"
  | "fechaRegistro" | "fechaExtravio" | "alcaldia" | "coloniaZona" | "momentoDelDia" | "direccionAproximada" | "referenciasDelLugar" | "motivo" | "descripcionCircunstancias"
  | "estado" | "historial"
>;
/** Lo que viaja a la LISTA de ADM-04: nunca los datos reservados del extravío, que solo se ven en el detalle. */
export type RegistroAdminLista = Pick<RegistroAdmin, "folio" | "nombre" | "fotografiaUrl" | "fechaRegistro" | "alcaldia" | "estado" | "historial">;

/** Campos permitidos, en el mismo orden que el tipo (la verificación compara las llaves de cada objeto con estas listas). */
export const CAMPOS_REGISTRO_ADMIN = [
  "folio", "nombre", "sexo", "raza", "razaEspecificada", "edadValor", "edadUnidad", "tamano", "color", "caracteristicasDistintivas", "fotografiaUrl",
  "fechaRegistro", "fechaExtravio", "alcaldia", "coloniaZona", "momentoDelDia", "direccionAproximada", "referenciasDelLugar", "motivo", "descripcionCircunstancias", "estado", "historial",
] as const;
export const CAMPOS_REGISTRO_ADMIN_LISTA = ["folio", "nombre", "fotografiaUrl", "fechaRegistro", "alcaldia", "estado", "historial"] as const;

const aRegistroAdmin = (c: CasoTutor): RegistroAdmin =>
  Object.fromEntries(CAMPOS_REGISTRO_ADMIN.map((k) => [k, c[k]])) as RegistroAdmin;
export const aRegistroAdminLista = (c: RegistroAdmin): RegistroAdminLista =>
  Object.fromEntries(CAMPOS_REGISTRO_ADMIN_LISTA.map((k) => [k, c[k]])) as RegistroAdminLista;

/** Todos los casos del sistema para moderar, del más reciente al más antiguo (HU 018). Cada uno trae su historial de estados. */
export const CASOS_MODERACION: readonly RegistroAdmin[] = [...CASOS_ORIGEN.map((c) => aCasoTutor(c)), ...EXTRAS].map(aRegistroAdmin).sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

/** Casos de ejemplo de cada modal y variante (capturas y pruebas). */
export const FOLIO_MODERACION_DESHABILITADO = "RUPE-D5W2QK8X";
export const FOLIO_MODERACION_CANCELADO = "RUPE-F7L3MN6Y";
export const FOLIO_MODERACION_ACTIVO = "RUPE-K7M4XQ9T";

// ---------- Avistamientos ----------

export type AvistamientoModeracion = AvistamientoRecibido & {
  visible: boolean;
  /** Obligatorio cuando está oculto (CHECK visible = 1 OR motivo_moderacion IS NOT NULL); se limpia al restaurar (decisión D12). */
  motivoModeracion?: string;
  /** Cuándo se ocultó (ISO 8601, UTC). */
  fechaModeracion?: string;
};

/** Avistamientos ocultos por moderación: ya no aparecen en el historial de la persona tutora, por eso no están en AVISTAMIENTOS. */
const OCULTOS: AvistamientoModeracion[] = [
  {
    id: 105, folio: "RUPE-Y9F4LK2E", fechaHora: "2026-10-07T01:10:00Z", coloniaZona: "Ejército de Oriente", latitud: 19.3649, longitud: -99.0611, alcaldia: "Iztapalapa",
    estadosAnimal: ["Ileso / Buen estado", "Libre en vía pública (suelto o en movimiento)"], comentario: "Texto con datos de contacto de un tercero.", fotografiaUrl: FOTO,
    visible: false, motivoModeracion: "El comentario incluía un número telefónico de una persona ajena al caso.", fechaModeracion: "2026-10-09T17:30:00Z",
  },
  {
    id: 303, folio: "RUPE-N8D5GX3W", fechaHora: "2026-10-12T22:25:00Z", coloniaZona: "Narvarte Oriente", latitud: 19.3951, longitud: -99.1481, alcaldia: "Benito Juárez",
    estadosAnimal: ["Enfermo / débil", "Resguardado / En custodia temporal"], fotografiaUrl: FOTO,
    visible: false, motivoModeracion: "La fotografía no corresponde a un perro.", fechaModeracion: "2026-10-13T11:15:00Z",
  },
];

/** Datos completos de los avistamientos ocultos (el Prototipo los siembra en el almacén; el Administrador solo recibe la versión permitida). */
export const AVISTAMIENTOS_OCULTOS_ORIGEN: readonly AvistamientoModeracion[] = OCULTOS;

/**
 * Lo que el Administrador ve de un avistamiento (HU 037): sin dirección, referencias, colonia ni coordenadas, que son reservadas a la persona
 * tutora (TUT-10). Lista permitida: esos datos ni siquiera viajan en la página.
 */
export type AvistamientoAdmin = Pick<AvistamientoModeracion, "id" | "folio" | "fechaHora" | "alcaldia" | "estadosAnimal" | "comentario" | "fotografiaUrl" | "visible" | "motivoModeracion" | "fechaModeracion">;
const aAvistamientoAdmin = (a: AvistamientoModeracion): AvistamientoAdmin => ({
  id: a.id, folio: a.folio, fechaHora: a.fechaHora, alcaldia: a.alcaldia, estadosAnimal: a.estadosAnimal, comentario: a.comentario, fotografiaUrl: a.fotografiaUrl,
  visible: a.visible, motivoModeracion: a.motivoModeracion, fechaModeracion: a.fechaModeracion,
});

/** Todos los avistamientos para moderar, del más reciente al más antiguo: los visibles de la maqueta y los ocultos. */
export const AVISTAMIENTOS_MODERACION: readonly AvistamientoAdmin[] = [...AVISTAMIENTOS.map((a): AvistamientoModeracion => ({ ...a, visible: true })), ...OCULTOS].map(aAvistamientoAdmin).sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));

export const ID_AVISTAMIENTO_FALLECIDO = AVISTAMIENTOS.find(esFallecido)!.id;
export const ID_AVISTAMIENTO_VISIBLE = 201;
export const ID_AVISTAMIENTO_OCULTO = 105;
export { FOTO_SENSIBLE };

if (process.env.NODE_ENV !== "production") {
  const folios = new Set(CASOS_MODERACION.map((c) => c.folio));
  if (folios.size !== CASOS_MODERACION.length) throw new Error("Folios duplicados en la moderación");
  for (const a of AVISTAMIENTOS_MODERACION) {
    if (!folios.has(a.folio)) throw new Error(`Avistamiento ${a.id} de un caso inexistente`);
    if (!a.visible && !a.motivoModeracion) throw new Error(`Avistamiento ${a.id} oculto sin motivo de moderación`);
  }
  if (new Set(AVISTAMIENTOS_MODERACION.map((a) => a.id)).size !== AVISTAMIENTOS_MODERACION.length) throw new Error("Avistamientos duplicados en la moderación");
}
