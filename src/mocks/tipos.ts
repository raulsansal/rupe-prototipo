// Tipos base alineados al diccionario de datos (docs/referencia/diccionario-de-datos.docx).
// Solo datos ficticios en esta fase.

export const ALCALDIAS = [
  "Álvaro Obregón", "Azcapotzalco", "Benito Juárez", "Coyoacán", "Cuajimalpa de Morelos",
  "Cuauhtémoc", "Gustavo A. Madero", "Iztacalco", "Iztapalapa", "La Magdalena Contreras",
  "Miguel Hidalgo", "Milpa Alta", "Tláhuac", "Tlalpan", "Venustiano Carranza", "Xochimilco",
] as const;
export type Alcaldia = (typeof ALCALDIAS)[number];

/** Solo la asigna el sistema a avistamientos fuera de la ciudad (R14); no se ofrece al registrar un caso. */
export const FUERA_DE_LA_CIUDAD = "Fuera de la Ciudad de México" as const;
export type AlcaldiaAvistamiento = Alcaldia | typeof FUERA_DE_LA_CIUDAD;

export const ESTADOS_CASO = [
  "Extraviado", "En búsqueda", "Avistamiento reportado", "En seguimiento", "Localizado", "Cerrado",
] as const;
export type EstadoCaso = (typeof ESTADOS_CASO)[number];

export type Sexo = "Macho" | "Hembra" | "No sé";
export type EdadUnidad = "meses" | "años";
export type Tamano = "pequeño" | "mediano" | "grande";
export type MomentoDelDia = "madrugada" | "mañana" | "tarde" | "noche" | "desconocido";

/** 'RUPE-' + 8 caracteres de A–Z sin I ni O, y 2–9 (13 caracteres). */
export const PATRON_FOLIO = /^RUPE-[A-HJ-NP-Z2-9]{8}$/;
export type Folio = `RUPE-${string}`;

/**
 * Edad (CHECK del diccionario): meses entre 0 y 11, años entre 1 y 50.
 * "Menos de 1 mes" se guarda como 0 meses.
 */
export type Perro = {
  nombre: string; // ≤ 50
  sexo: Sexo;
  edadValor: number;
  edadUnidad: EdadUnidad;
  tamano: Tamano;
  color: string; // ≤ 50
  caracteristicasDistintivas?: string; // ≤ 300
  razaEspecificada?: string; // ≤ 50; solo cuando la raza es "Otra" (R8)
  raza: string; // nombre de la raza del catálogo (público); el diccionario guarda id_raza
  fotografiaUrl: string; // el diccionario guarda id_fotografia; el archivo es público
};

export type CasoExtravio = {
  folio: Folio;
  fechaExtravio: string; // AAAA-MM-DD, no futura
  momentoDelDia: MomentoDelDia; // reservado
  coloniaZona: string; // ≤ 100
  direccionAproximada?: string; // ≤ 200, reservado (calle o cruce)
  referenciasDelLugar?: string; // ≤ 500, reservado
  descripcionCircunstancias?: string; // ≤ 1000, reservado
  alcaldia: Alcaldia; // sin "Fuera de la Ciudad de México" (R14)
  motivo: string; // reservado; nombre del catálogo de motivos
  estado: EstadoCaso;
};

/**
 * Según el diccionario, direccionAproximada, coloniaZona y referencias son opcionales en el
 * avistamiento (la dirección solo es obligatoria en la forma escrita) y latitud/longitud son obligatorias.
 */
export type Avistamiento = {
  fechaHora: string; // ISO 8601, no posterior al envío
  direccionAproximada?: string; // ≤ 200
  coloniaZona?: string; // ≤ 100
  referencias?: string; // ≤ 500
  latitud: number; // −90 a 90, 6 decimales
  longitud: number; // −180 a 180, 6 decimales
  precisionGps?: number; // metros, ≥ 0; solo con GPS
  comentario?: string; // ≤ 300
  alcaldia: AlcaldiaAvistamiento;
  estadosAnimal: string[]; // nombres del catálogo de estados del animal
};

/**
 * Solo campos PÚBLICOS. Nunca incluir: calle o cruce, referencias, momento del día, motivo,
 * descripción ni datos de la persona tutora.
 */
export type FichaPublica = {
  nombre: Perro["nombre"];
  sexo: Perro["sexo"];
  raza: Perro["raza"];
  edadValor: Perro["edadValor"];
  edadUnidad: Perro["edadUnidad"];
  tamano: Perro["tamano"];
  color: Perro["color"];
  caracteristicasDistintivas?: Perro["caracteristicasDistintivas"];
  fotografiaUrl: Perro["fotografiaUrl"];
  fechaExtravio: CasoExtravio["fechaExtravio"];
  alcaldia: CasoExtravio["alcaldia"]; // solo su nombre
  coloniaZona: CasoExtravio["coloniaZona"];
  folio: CasoExtravio["folio"];
  estado: CasoExtravio["estado"];
};
