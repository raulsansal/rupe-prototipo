import { ESTADO_ANIMAL_RESGUARDADO, PATRON_FOLIO, type Avistamiento, type FichaTutor } from "./tipos";

/** Datos ficticios para maquetas. Nada de esto es real. */
const FOTO = "/mocks/perro-ejemplo.svg";

export const FICHAS_EJEMPLO = [
  { nombre: "Max", sexo: "Macho", raza: "Mestizo", edadValor: 4, edadUnidad: "años", tamano: "mediano", color: "Café con blanco", caracteristicasDistintivas: "Collar rojo con placa, mancha negra en la oreja derecha.", fotografiaUrl: FOTO, fechaExtravio: "2026-10-18", alcaldia: "Coyoacán", coloniaZona: "Del Carmen", folio: "RUPE-K7M4XQ9T", estado: "En búsqueda" },
  { nombre: "Luna", sexo: "Hembra", raza: "Labrador", edadValor: 2, edadUnidad: "años", tamano: "grande", color: "Dorado", fotografiaUrl: FOTO, fechaExtravio: "2026-10-14", alcaldia: "Benito Juárez", coloniaZona: "Del Valle Centro", folio: "RUPE-P3H8WD5N", estado: "Avistamiento reportado" },
  { nombre: "Toby", sexo: "Macho", raza: "Chihuahua", edadValor: 8, edadUnidad: "meses", tamano: "pequeño", color: "Canela", fotografiaUrl: FOTO, fechaExtravio: "2026-10-06", alcaldia: "Tlalpan", coloniaZona: "Héroes de Padierna", folio: "RUPE-B6R2TZ7C", estado: "Localizado", fechaCambioEstado: "2026-10-09T18:20:00Z" },
  { nombre: "Nala", sexo: "Hembra", raza: "Pastor Alemán", edadValor: 5, edadUnidad: "años", tamano: "grande", color: "Negro con fuego", fotografiaUrl: FOTO, fechaExtravio: "2026-10-04", alcaldia: "Iztapalapa", coloniaZona: "Santa Martha Acatitla", folio: "RUPE-Y9F4LK2E", estado: "En seguimiento" },
] as const satisfies readonly FichaTutor[];

export const AVISTAMIENTO_EJEMPLO = {
  fechaHora: "2026-10-18T16:30:00Z", // 10:30 hora de la Ciudad de México
  direccionAproximada: "Av. Insurgentes y Chilpancingo",
  coloniaZona: "Roma Sur",
  latitud: 19.40623,
  longitud: -99.17168,
  alcaldia: "Cuauhtémoc",
  estadosAnimal: ["Ileso / Buen estado", ESTADO_ANIMAL_RESGUARDADO, "Dócil / amigable"],
  fotografiaUrl: FOTO,
} as const satisfies Avistamiento;

if (process.env.NODE_ENV !== "production") {
  for (const f of FICHAS_EJEMPLO) if (!PATRON_FOLIO.test(f.folio)) throw new Error(`Folio de ejemplo inválido: ${f.folio}`);
}
