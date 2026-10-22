// Estados iniciales para capturas y pruebas: ?paso=1..6, ?ubicacion=direccion|mapa|gps|denegado, ?caso=fallecido|combinadas|vacio
// y ?datos=ejemplo. Son solo el punto de partida del componente de cliente; nada se guarda.
import { SELECCION_VACIA } from "@/lib/estadoAnimal";
import { coordenadasSugeridas } from "@/mocks/geografia";
import type { DatosAvistamiento } from "./datos";

export type ParametrosVariante = { paso?: string; ubicacion?: string; caso?: string; datos?: string };
export type EstadoInicial = { paso: number; datos: Partial<DatosAvistamiento>; abrirTodasCategorias: boolean };

const PUNTO_EJEMPLO = { latitud: 19.40623, longitud: -99.17168 };

const EJEMPLO: Partial<DatosAvistamiento> = {
  fotoUrl: "/mocks/perro-ejemplo.svg",
  forma: "direccion",
  direccion: "Av. Insurgentes y Chilpancingo",
  alcaldiaElegida: "Cuauhtémoc",
  punto: PUNTO_EJEMPLO,
  confirmado: true,
  colonia: "Roma Sur",
  referencias: "Frente a una farmacia.",
  fecha: "2026-10-18",
  hora: "10:30",
  estados: { 1: [2, 3], 2: [8], 3: [11], 4: [15] },
  comentario: "Iba hacia el parque y se veía tranquilo.",
};

export function estadoInicial({ paso, ubicacion, caso, datos }: ParametrosVariante): EstadoInicial {
  let d: Partial<DatosAvistamiento> = datos === "ejemplo" ? { ...EJEMPLO } : {};
  let pasoInicial = Number(paso);

  if (ubicacion === "direccion") d = { ...d, forma: "direccion", direccion: "Av. Insurgentes y Chilpancingo", alcaldiaElegida: "Cuauhtémoc", punto: coordenadasSugeridas("Cuauhtémoc"), confirmado: false };
  if (ubicacion === "mapa") d = { ...d, forma: "mapa", punto: PUNTO_EJEMPLO, confirmado: false };
  if (ubicacion === "gps") d = { ...d, forma: "gps", punto: PUNTO_EJEMPLO, confirmado: true, estadoGps: "obtenida", precisionGps: 12 };
  if (ubicacion === "denegado") d = { ...d, forma: "gps", punto: undefined, confirmado: false, estadoGps: "denegada" };

  if (caso === "fallecido") d = { ...d, estados: { ...SELECCION_VACIA, 1: [5], 2: [7] } };
  if (caso === "combinadas") d = { ...d, estados: { ...SELECCION_VACIA, 1: [2, 3], 2: [8] } };

  if (!(pasoInicial >= 1 && pasoInicial <= 6)) pasoInicial = ubicacion ? 3 : caso ? 4 : 1;
  return { paso: pasoInicial, datos: d, abrirTodasCategorias: Boolean(caso) };
}
