// Casos de origen de la maqueta: lo que hoy guardaría la base de datos, incluidos los datos RESERVADOS y los de la
// persona tutora. Las pantallas públicas nunca reciben esto: pasan por `aFichaPublica`, que copia solo los campos
// públicos (lista permitida). `scripts/verificar-visitante.ts` usa estos mismos valores para comprobar que no se filtran.
import type { CasoExtravio, EstadoCaso, FichaPublica, Folio, Perro } from "./tipos";

const FOTO = "/mocks/perro-ejemplo.svg";

/** Datos de la persona tutora (tbl_usuario): nunca son públicos. */
export type DatosTutor = { nombreCompleto: string; correo: string; telefono: string };

export type CasoOrigen = Perro & CasoExtravio & { tutor: DatosTutor; tokenPublico: string };

/** Token ficticio de 32 caracteres para la URL del QR (CHAR(32) en el diccionario). */
const token = (folio: Folio) => `MAQUETA${folio.slice(5)}`.padEnd(32, "0");

type Base = Omit<CasoOrigen, "tokenPublico" | "tutor"> & { tutor?: DatosTutor };

const TUTOR: DatosTutor = { nombreCompleto: "Rosa Hernández Ficticia", correo: "rosa.ficticia@example.org", telefono: "5500000000" };

const casos: Base[] = [
  {
    nombre: "Max", sexo: "Macho", raza: "Mestizo", edadValor: 4, edadUnidad: "años", tamano: "mediano", color: "Café con blanco",
    caracteristicasDistintivas: "Collar rojo con placa, mancha negra en la oreja derecha.", fotografiaUrl: FOTO,
    folio: "RUPE-K7M4XQ9T", fechaExtravio: "2026-10-18", momentoDelDia: "tarde", coloniaZona: "Narvarte Poniente",
    direccionAproximada: "Calle Reservada 123, esquina Cruce Secreto", referenciasDelLugar: "Referencia reservada: frente a la tienda azul",
    descripcionCircunstancias: "Descripción reservada: se soltó de la correa durante un paseo.", alcaldia: "Coyoacán", motivo: "Motivo reservado: escape durante el paseo",
    estado: "En búsqueda",
  },
  {
    nombre: "Luna", sexo: "Hembra", raza: "Labrador", edadValor: 2, edadUnidad: "años", tamano: "grande", color: "Dorado", fotografiaUrl: FOTO,
    folio: "RUPE-P3H8WD5N", fechaExtravio: "2026-10-14", momentoDelDia: "noche", coloniaZona: "Del Valle Centro",
    direccionAproximada: "Avenida Reservada 45", referenciasDelLugar: "Referencia reservada: cerca del parque", descripcionCircunstancias: "Descripción reservada: puerta abierta.",
    alcaldia: "Benito Juárez", motivo: "Motivo reservado: puerta abierta", estado: "Avistamiento reportado",
  },
  {
    nombre: "Toby", sexo: "Macho", raza: "Chihuahua", edadValor: 8, edadUnidad: "meses", tamano: "pequeño", color: "Canela", fotografiaUrl: FOTO,
    folio: "RUPE-B6R2TZ7C", fechaExtravio: "2026-10-06", momentoDelDia: "mañana", coloniaZona: "Héroes de Padierna",
    direccionAproximada: "Privada Reservada 7", referenciasDelLugar: "Referencia reservada: junto a la caseta", descripcionCircunstancias: "Descripción reservada: susto por cohetes.",
    alcaldia: "Tlalpan", motivo: "Motivo reservado: susto", estado: "Localizado", fechaCambioEstado: "2026-10-09T18:20:00Z",
  },
  {
    nombre: "Nala", sexo: "Hembra", raza: "Pastor Alemán", edadValor: 5, edadUnidad: "años", tamano: "grande", color: "Negro con fuego", fotografiaUrl: FOTO,
    folio: "RUPE-Y9F4LK2E", fechaExtravio: "2026-10-04", momentoDelDia: "madrugada", coloniaZona: "Santa Martha Acatitla",
    direccionAproximada: "Calzada Reservada 900", referenciasDelLugar: "Referencia reservada: atrás del mercado", descripcionCircunstancias: "Descripción reservada: ruptura de reja.",
    alcaldia: "Iztapalapa", motivo: "Motivo reservado: reja dañada", estado: "En seguimiento",
  },
  {
    nombre: "Rocky", sexo: "Macho", raza: "Schnauzer", edadValor: 6, edadUnidad: "años", tamano: "mediano", color: "Gris", fotografiaUrl: FOTO,
    folio: "RUPE-3HN8WD2B", fechaExtravio: "2026-09-12", momentoDelDia: "desconocido", coloniaZona: "Pensil Norte",
    direccionAproximada: "Calle Reservada 31", referenciasDelLugar: "Referencia reservada: esquina con la farmacia", descripcionCircunstancias: "Descripción reservada: caso cerrado.",
    alcaldia: "Miguel Hidalgo", motivo: "Motivo reservado: desconocido", estado: "Cerrado",
  },
];

export const CASOS_ORIGEN: readonly CasoOrigen[] = casos.map((c) => ({ ...c, tutor: c.tutor ?? TUTOR, tokenPublico: token(c.folio) }));

/** Folio con formato válido que no existe en la maqueta (estado «folio no encontrado»). */
export const FOLIO_INEXISTENTE: Folio = "RUPE-Z5C6VR4P";

/** Folio ficticio de un caso en curso, para enlaces de ejemplo. */
export const FOLIO_EN_CURSO: Folio = "RUPE-K7M4XQ9T";

/** Resuelve la clave de la URL: el folio o el token de 32 caracteres del QR. */
export function resolverCaso(clave: string): CasoOrigen | undefined {
  return CASOS_ORIGEN.find((c) => c.folio === clave.toUpperCase() || c.tokenPublico === clave);
}

/** Copia SOLO los campos de `FichaPublica` (lista permitida): calle, referencias, momento, motivo, descripción y tutor no salen. */
export function aFichaPublica(c: CasoOrigen): FichaPublica {
  return {
    nombre: c.nombre,
    sexo: c.sexo,
    raza: c.raza,
    edadValor: c.edadValor,
    edadUnidad: c.edadUnidad,
    tamano: c.tamano,
    color: c.color,
    caracteristicasDistintivas: c.caracteristicasDistintivas,
    fotografiaUrl: c.fotografiaUrl,
    fechaExtravio: c.fechaExtravio,
    alcaldia: c.alcaldia,
    coloniaZona: c.coloniaZona,
    folio: c.folio,
    estado: c.estado,
  };
}

/** ¿Acepta avistamientos? Un caso «Localizado» o «Cerrado» no (R13). */
export function aceptaAvistamientos(estado: EstadoCaso): boolean {
  return estado !== "Localizado" && estado !== "Cerrado";
}

/** Texto de cada reservado del origen, para la verificación: si aparece en el HTML de la ficha, hay una fuga. */
export function valoresReservados(c: CasoOrigen): string[] {
  return [c.direccionAproximada, c.referenciasDelLugar, c.descripcionCircunstancias, c.motivo, c.tutor.nombreCompleto, c.tutor.correo, c.tutor.telefono].filter((v): v is string => Boolean(v));
}
