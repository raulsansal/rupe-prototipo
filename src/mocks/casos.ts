// Casos de origen de la maqueta: lo que hoy guardaría la base de datos, incluidos los datos RESERVADOS y los de la
// persona tutora. Las pantallas públicas nunca reciben esto: pasan por `aFichaPublica`, que copia solo los campos
// públicos (lista permitida). `scripts/verificar-visitante.ts` usa estos mismos valores para comprobar que no se filtran.
import type { CasoExtravio, CasoTutor, EstadoCaso, FichaPublica, FichaTutor, Folio, MovimientoHistorial, Perro } from "./tipos";

const FOTO = "/mocks/perro-ejemplo.svg";

/** Datos de la persona tutora (tbl_usuario): nunca son públicos. */
export type DatosTutor = { nombreCompleto: string; correo: string; telefono: string };

export type CasoOrigen = Perro & CasoExtravio & { tutor: DatosTutor; tokenPublico: string; fechaRegistro: string };

/** Token ficticio de 32 caracteres para la URL del QR (CHAR(32) en el diccionario). */
const token = (folio: Folio) => `MAQUETA${folio.slice(5)}`.padEnd(32, "0");

type Base = Omit<CasoOrigen, "tokenPublico" | "tutor"> & { tutor?: DatosTutor };

const TUTOR: DatosTutor = { nombreCompleto: "Rosa Hernández Ficticia", correo: "rosa.ficticia@example.org", telefono: "5500000000" };

const casos: Base[] = [
  {
    nombre: "Max", sexo: "Macho", raza: "Mestizo", edadValor: 4, edadUnidad: "años", tamano: "mediano", color: "Café con blanco",
    caracteristicasDistintivas: "Collar rojo con placa, mancha negra en la oreja derecha.", fotografiaUrl: FOTO,
    folio: "RUPE-K7M4XQ9T", fechaRegistro: "2026-10-18T22:10:00Z", fechaExtravio: "2026-10-18", momentoDelDia: "tarde", coloniaZona: "Del Carmen",
    direccionAproximada: "Calle Reservada 123, esquina Cruce Secreto", referenciasDelLugar: "Referencia reservada: frente a la tienda azul",
    descripcionCircunstancias: "Descripción reservada: se soltó de la correa durante un paseo.", alcaldia: "Coyoacán", motivo: "Accidentes o imprevistos durante el paseo",
    estado: "En búsqueda",
  },
  {
    nombre: "Luna", sexo: "Hembra", raza: "Labrador", edadValor: 2, edadUnidad: "años", tamano: "grande", color: "Dorado", fotografiaUrl: FOTO,
    folio: "RUPE-P3H8WD5N", fechaRegistro: "2026-10-14T19:40:00Z", fechaExtravio: "2026-10-14", momentoDelDia: "noche", coloniaZona: "Del Valle Centro",
    direccionAproximada: "Avenida Reservada 45", referenciasDelLugar: "Referencia reservada: cerca del parque", descripcionCircunstancias: "Descripción reservada: puerta abierta.",
    alcaldia: "Benito Juárez", motivo: "Portones o puertas abiertas", estado: "Avistamiento reportado",
  },
  {
    nombre: "Toby", sexo: "Macho", raza: "Chihuahua", edadValor: 8, edadUnidad: "meses", tamano: "pequeño", color: "Canela", fotografiaUrl: FOTO,
    folio: "RUPE-B6R2TZ7C", fechaRegistro: "2026-10-06T15:05:00Z", fechaExtravio: "2026-10-06", momentoDelDia: "mañana", coloniaZona: "Héroes de Padierna",
    direccionAproximada: "Privada Reservada 7", referenciasDelLugar: "Referencia reservada: junto a la caseta", descripcionCircunstancias: "Descripción reservada: susto por cohetes.",
    alcaldia: "Tlalpan", motivo: "Pánico por ruidos fuertes", estado: "Localizado", fechaCambioEstado: "2026-10-09T18:20:00Z",
  },
  {
    nombre: "Nala", sexo: "Hembra", raza: "Pastor Alemán", edadValor: 5, edadUnidad: "años", tamano: "grande", color: "Negro con fuego", fotografiaUrl: FOTO,
    folio: "RUPE-Y9F4LK2E", fechaRegistro: "2026-10-04T13:30:00Z", fechaExtravio: "2026-10-04", momentoDelDia: "madrugada", coloniaZona: "Santa Martha Acatitla",
    direccionAproximada: "Calzada Reservada 900", referenciasDelLugar: "Referencia reservada: atrás del mercado", descripcionCircunstancias: "Descripción reservada: ruptura de reja.",
    alcaldia: "Iztapalapa", motivo: "Deficiencias en cercas o bardas", estado: "En seguimiento",
  },
  {
    nombre: "Rocky", sexo: "Macho", raza: "Schnauzer", edadValor: 6, edadUnidad: "años", tamano: "mediano", color: "Gris", fotografiaUrl: FOTO,
    folio: "RUPE-3HN8WD2B", fechaRegistro: "2026-09-12T17:00:00Z", fechaExtravio: "2026-09-12", momentoDelDia: "desconocido", coloniaZona: "Pensil Norte",
    direccionAproximada: "Calle Reservada 31", referenciasDelLugar: "Referencia reservada: esquina con la farmacia", descripcionCircunstancias: "Descripción reservada: caso cerrado.",
    alcaldia: "Miguel Hidalgo", motivo: "Circunstancia desconocida o no presenciada", estado: "Cerrado",
  },
  {
    nombre: "Coco", sexo: "Hembra", raza: "Poodle (Caniche)", edadValor: 11, edadUnidad: "meses", tamano: "pequeño", color: "Blanco", fotografiaUrl: FOTO,
    folio: "RUPE-H4TQ7V2M", fechaRegistro: "2026-10-12T16:20:00Z", fechaExtravio: "2026-10-12", momentoDelDia: "mañana", coloniaZona: "Lindavista",
    direccionAproximada: "Calle Reservada 18", referenciasDelLugar: "Referencia reservada: cerca del mercado", descripcionCircunstancias: "Descripción reservada: salió con el repartidor.",
    alcaldia: "Gustavo A. Madero", motivo: "Portones o puertas abiertas", estado: "En búsqueda",
  },
  {
    nombre: "Bruno", sexo: "Macho", raza: "Bulldog Francés", edadValor: 3, edadUnidad: "años", tamano: "mediano", color: "Atigrado", fotografiaUrl: FOTO,
    folio: "RUPE-N8D5GX3W", fechaRegistro: "2026-10-09T14:00:00Z", fechaExtravio: "2026-10-09", momentoDelDia: "tarde", coloniaZona: "Portales Sur",
    direccionAproximada: "Calle Reservada 52", referenciasDelLugar: "Referencia reservada: junto al parque", descripcionCircunstancias: "Descripción reservada: se zafó del arnés.",
    alcaldia: "Benito Juárez", motivo: "Equipo de sujeción defectuoso", estado: "Avistamiento reportado",
  },
  {
    nombre: "Lola", sexo: "Hembra", raza: "Mestizo/No identificada", edadValor: 7, edadUnidad: "años", tamano: "grande", color: "Negro", fotografiaUrl: FOTO,
    folio: "RUPE-C2J9RK6Z", fechaRegistro: "2026-09-25T18:45:00Z", fechaExtravio: "2026-09-25", momentoDelDia: "noche", coloniaZona: "San Ángel",
    direccionAproximada: "Avenida Reservada 700", referenciasDelLugar: "Referencia reservada: frente a la iglesia", descripcionCircunstancias: "Descripción reservada: pirotecnia.",
    alcaldia: "Álvaro Obregón", motivo: "Pánico por ruidos fuertes", estado: "Localizado", fechaCambioEstado: "2026-09-28T20:10:00Z",
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

/** Folio que se asigna en la maqueta al guardar un registro nuevo (siempre el mismo: no se crea nada). */
export const FOLIO_NUEVO: Folio = FOLIO_EN_CURSO;

/** «Mis registros»: los casos de la persona tutora, por fecha de creación descendente (HU 015). */
export const casosDeLaPersonaTutora = (): CasoOrigen[] => [...CASOS_ORIGEN].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

const sumarHoras = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600 * 1000).toISOString().replace(".000Z", "Z");

/** Historial del caso según su estado (R12): una cadena válida de movimientos; la maqueta no guarda uno real. */
export function construirHistorial(estado: EstadoCaso, fechaRegistro: string, fechaCambioEstado?: string): MovimientoHistorial[] {
  const m: Omit<MovimientoHistorial, "consecutivo">[] = [{ tipo: "registro", estado: "Extraviado", fechaHora: fechaRegistro }];
  const t = (h: number) => sumarHoras(fechaRegistro, h);
  const hasta = (e: EstadoCaso) => ["En búsqueda", "Avistamiento reportado", "En seguimiento", "Localizado", "Cerrado"].indexOf(e);
  if (hasta(estado) >= 0) m.push({ tipo: "ficha generada", estado: "En búsqueda", fechaHora: t(0.01) });
  if (hasta(estado) >= 1) m.push({ tipo: "avistamiento recibido", estado: "Avistamiento reportado", fechaHora: t(30) });
  if (hasta(estado) >= 2) m.push({ tipo: "avistamiento revisado", estado: "En seguimiento", fechaHora: t(31) });
  if (hasta(estado) >= 3) m.push({ tipo: "localización", estado: "Localizado", fechaHora: fechaCambioEstado ?? t(60) });
  if (hasta(estado) >= 4) m.push({ tipo: "cierre confirmado", estado: "Cerrado", fechaHora: t(120) });
  return m.map((x, i) => ({ ...x, consecutivo: i + 1 }));
}

/**
 * Movimientos de moderación que ya ocurrieron en casos de la maqueta (los mismos que registra la bitácora, HU 058): el caso estuvo deshabilitado y se
 * restauró al estado que tenía antes, así que su historial los conserva en orden cronológico.
 */
const MOVIMIENTOS_MODERACION: Record<string, Omit<MovimientoHistorial, "consecutivo">[]> = {
  "RUPE-C2J9RK6Z": [
    { tipo: "deshabilitación", estado: "Cerrado", fechaHora: "2026-09-27T20:20:00Z", motivo: "La fotografía requería verificación." },
    { tipo: "restauración", estado: "En seguimiento", fechaHora: "2026-09-28T10:15:00Z" },
  ],
};
const conModeracion = (folio: string, h: MovimientoHistorial[]): MovimientoHistorial[] =>
  MOVIMIENTOS_MODERACION[folio] ? [...h, ...MOVIMIENTOS_MODERACION[folio].map((m) => ({ ...m, consecutivo: 0 }))].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)).map((m, i) => ({ ...m, consecutivo: i + 1 })) : h;

/** Vista de la persona tutora dueña: todo lo suyo del caso, sin sus datos personales ni el token del QR. `estado` fuerza una variante. */
export function aCasoTutor(c: CasoOrigen, estado: EstadoCaso = c.estado): CasoTutor {
  const { nombre, sexo, edadValor, edadUnidad, tamano, color, caracteristicasDistintivas, razaEspecificada, raza, fotografiaUrl } = c;
  const { folio, fechaExtravio, momentoDelDia, coloniaZona, direccionAproximada, referenciasDelLugar, descripcionCircunstancias, alcaldia, motivo, fechaCambioEstado, fechaRegistro } = c;
  return {
    nombre, sexo, edadValor, edadUnidad, tamano, color, caracteristicasDistintivas, razaEspecificada, raza, fotografiaUrl,
    folio, fechaExtravio, momentoDelDia, coloniaZona, direccionAproximada, referenciasDelLugar, descripcionCircunstancias, alcaldia, motivo, estado, fechaCambioEstado, fechaRegistro,
    historial: estado === c.estado ? conModeracion(folio, construirHistorial(estado, fechaRegistro, fechaCambioEstado)) : construirHistorial(estado, fechaRegistro, fechaCambioEstado),
  };
}

/** Lo que muestra la lista «Mis registros»: la ficha pública más la fecha del último cambio de estado. */
export const aFichaTutor = (c: CasoOrigen): FichaTutor => ({ ...aFichaPublica(c), fechaCambioEstado: c.fechaCambioEstado });
