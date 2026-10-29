// Estados iniciales para capturas y pruebas: ?paso=1..6, ?caso=fallecido|combinadas|vacio|libre|no-disponible y ?datos=ejemplo. Son solo el punto de partida del componente de cliente; nada se guarda.
import { SELECCION_VACIA } from "@/lib/estadoAnimal";
import type { DatosAvistamiento } from "./datos";

export type ParametrosVariante = { paso?: string; caso?: string; datos?: string };
export type EstadoInicial = { paso: number; datos: Partial<DatosAvistamiento>; abrirTodasCategorias: boolean };

const EJEMPLO: Partial<DatosAvistamiento> = {
  fotoUrl: "/mocks/perro-ejemplo.svg",
  direccion: "Av. Insurgentes y Chilpancingo",
  alcaldiaElegida: "6",
  colonia: "Roma Sur",
  referencias: "Frente a una farmacia.",
  fecha: "2026-10-18",
  hora: "10:30",
  estados: { 1: [2, 3], 2: [8], 3: [11], 4: [15] },
  comentario: "Iba hacia el parque y se veía tranquilo.",
};

export function estadoInicial({ paso, caso, datos }: ParametrosVariante): EstadoInicial {
  let d: Partial<DatosAvistamiento> = datos === "ejemplo" ? { ...EJEMPLO } : {};
  let pasoInicial = Number(paso);
  if (caso === "fallecido") d = { ...d, estados: { ...SELECCION_VACIA, 1: [5], 2: [7] } };
  if (caso === "combinadas") d = { ...d, estados: { ...SELECCION_VACIA, 1: [2, 3], 2: [8] } };
  // Solo capturas (retirar en P7).
  if (caso === "libre") d = { ...d, estados: { ...SELECCION_VACIA, 1: [1], 2: [7] } };
  // Solo pruebas y capturas (retirar en P7): una opción que la pantalla NO ofrece (id 99, inexistente) ya elegida, para ver cómo se muestra el rechazo «opción no disponible» del servidor.
  if (caso === "no-disponible") d = { ...d, estados: { ...SELECCION_VACIA, 1: [1], 2: [7], 4: [99] } };
  if (!(pasoInicial >= 1 && pasoInicial <= 6)) pasoInicial = caso ? 4 : 1;
  return { paso: pasoInicial, datos: d, abrirTodasCategorias: Boolean(caso) };
}
