// Avistamientos ficticios que reciben los casos de la maqueta (tbl_avistamiento, solo los visibles). El reporte es anónimo:
// el diccionario no guarda ningún dato de quien lo envía. Dirección aproximada y referencias son RESERVADAS (solo las ve la
// persona tutora dueña del caso): no deben aparecer en ninguna pantalla pública ni en la ficha de búsqueda.
import { erroresEstadoAnimal, SELECCION_VACIA, type SeleccionEstadoAnimal } from "../lib/estadoAnimal";
import { ESTADOS_ANIMAL } from "./catalogos";
import type { Avistamiento, Folio } from "./tipos";

export type AvistamientoRecibido = Avistamiento & { id: number; folio: Folio };

const FOTO = "/mocks/perro-ejemplo.svg";
/** Fotografía de un avistamiento «Fallecido»: nunca se muestra en listas y solo se ve con «Ver fotografía» (HU 040). */
export const FOTO_SENSIBLE = "/mocks/avistamiento-sensible.svg";

/** Caso con 4 avistamientos (uno «Fallecido»): lámina 2.7 con avistamientos y mapa con ruta. */
export const FOLIO_CON_AVISTAMIENTOS: Folio = "RUPE-Y9F4LK2E";
/** Caso con un solo avistamiento: «Ver ruta» no está disponible. */
export const FOLIO_UN_AVISTAMIENTO: Folio = "RUPE-P3H8WD5N";

const HERIDO = "Herido / lesionado";
const ENFERMO = "Enfermo / débil";
const ILESO = "Ileso / Buen estado";
const FALLECIDO = "Fallecido";
const INDETERMINADO = "No se puede determinar";
const LIBRE = "Libre en vía pública (suelto o en movimiento)";
const RESGUARDADO = "Resguardado / En custodia temporal";
const CLINICA = "En clínica o veterinaria";
const DOCIL = "Dócil / amigable";
const ASUSTADO = "Asustado / temeroso";
const PLACA = "Con placa y collar";
const SIN_ACCESORIOS = "Sin accesorios";

export const AVISTAMIENTOS: readonly AvistamientoRecibido[] = [
  // Nala (En seguimiento): 4 avistamientos; el 102 es «Fallecido».
  { id: 101, folio: "RUPE-Y9F4LK2E", fechaHora: "2026-10-05T16:20:00Z", direccionAproximada: "Calle Resguardo 14, entre Eje 6 y Callejón Norte", coloniaZona: "Santa Martha Acatitla", referencias: "Referencia del avistamiento: patio de una vecina, junto a la tienda azul", latitud: 19.3552, longitud: -99.071, alcaldia: "Iztapalapa", estadosAnimal: [HERIDO, ENFERMO, RESGUARDADO, ASUSTADO], comentario: "Está en el patio de una vecina; se ve asustada y cojea de una pata.", fotografiaUrl: FOTO },
  { id: 103, folio: "RUPE-Y9F4LK2E", fechaHora: "2026-10-06T21:45:00Z", direccionAproximada: "Avenida Vista Sur y Callejón Sombra", coloniaZona: "Los Ángeles Apanoaya", referencias: "Referencia del avistamiento: frente a una papelería", latitud: 19.3601, longitud: -99.0655, alcaldia: "Iztapalapa", estadosAnimal: [ILESO, LIBRE, DOCIL, PLACA], comentario: "Caminaba tranquila por la banqueta y se dejó acariciar.", fotografiaUrl: FOTO },
  { id: 104, folio: "RUPE-Y9F4LK2E", fechaHora: "2026-10-07T14:10:00Z", direccionAproximada: "Cruce Reservado Oriente y Calle Seis", coloniaZona: "Ejército de Oriente", latitud: 19.3668, longitud: -99.0589, alcaldia: "Iztapalapa", estadosAnimal: [INDETERMINADO, CLINICA], fotografiaUrl: FOTO },
  { id: 102, folio: "RUPE-Y9F4LK2E", fechaHora: "2026-10-08T13:35:00Z", direccionAproximada: "Camellón de la Calzada Reservada, altura del puente", coloniaZona: "Santa Cruz Meyehualco", referencias: "Referencia del avistamiento: junto al camellón, cerca del puente peatonal", latitud: 19.3721, longitud: -99.0524, alcaldia: "Iztapalapa", estadosAnimal: [FALLECIDO, LIBRE], comentario: "Estaba junto al camellón; avisé a una vecina.", fotografiaUrl: FOTO_SENSIBLE },
  // Luna (Avistamiento reportado): un solo avistamiento.
  { id: 201, folio: "RUPE-P3H8WD5N", fechaHora: "2026-10-16T19:05:00Z", direccionAproximada: "Calle Reservada Sur 88", coloniaZona: "Del Valle Centro", referencias: "Referencia del avistamiento: afuera de una cafetería", latitud: 19.3862, longitud: -99.1655, alcaldia: "Benito Juárez", estadosAnimal: [ILESO, LIBRE, ASUSTADO, SIN_ACCESORIOS], comentario: "Corría entre los autos; no quiso acercarse.", fotografiaUrl: FOTO },
  // Bruno (Avistamiento reportado): dos avistamientos.
  { id: 301, folio: "RUPE-N8D5GX3W", fechaHora: "2026-10-10T15:00:00Z", direccionAproximada: "Calle Reservada Poniente 12", coloniaZona: "Portales Sur", latitud: 19.3695, longitud: -99.1402, alcaldia: "Benito Juárez", estadosAnimal: [ENFERMO, RESGUARDADO, DOCIL], comentario: "Lo tiene un vecino; está decaído pero come.", fotografiaUrl: FOTO },
  { id: 302, folio: "RUPE-N8D5GX3W", fechaHora: "2026-10-11T12:30:00Z", direccionAproximada: "Avenida Reservada Norte 300", coloniaZona: "Narvarte Oriente", latitud: 19.3961, longitud: -99.1498, alcaldia: "Benito Juárez", estadosAnimal: [ILESO, LIBRE, PLACA], fotografiaUrl: FOTO },
  // Toby (Localizado): dos avistamientos previos a la localización.
  { id: 401, folio: "RUPE-B6R2TZ7C", fechaHora: "2026-10-07T17:15:00Z", direccionAproximada: "Privada Reservada 3", coloniaZona: "Héroes de Padierna", latitud: 19.2802, longitud: -99.2052, alcaldia: "Tlalpan", estadosAnimal: [ILESO, RESGUARDADO, DOCIL], fotografiaUrl: FOTO },
  { id: 402, folio: "RUPE-B6R2TZ7C", fechaHora: "2026-10-08T20:00:00Z", direccionAproximada: "Calle Reservada Alta 41", coloniaZona: "Fuentes Brotantes", latitud: 19.2931, longitud: -99.1887, alcaldia: "Tlalpan", estadosAnimal: [ILESO, LIBRE, ASUSTADO], fotografiaUrl: FOTO },
  // Lola (Localizado): tres avistamientos.
  { id: 501, folio: "RUPE-C2J9RK6Z", fechaHora: "2026-09-26T14:20:00Z", direccionAproximada: "Calle Reservada Azul 7", coloniaZona: "San Ángel", latitud: 19.3485, longitud: -99.1905, alcaldia: "Álvaro Obregón", estadosAnimal: [ILESO, LIBRE, ASUSTADO], fotografiaUrl: FOTO },
  { id: 502, folio: "RUPE-C2J9RK6Z", fechaHora: "2026-09-27T16:40:00Z", direccionAproximada: "Avenida Reservada Verde 90", coloniaZona: "Villa Coyoacán", latitud: 19.3441, longitud: -99.1832, alcaldia: "Coyoacán", estadosAnimal: [HERIDO, RESGUARDADO], comentario: "Una señora la recogió; tiene un raspón en la pata.", fotografiaUrl: FOTO },
  { id: 503, folio: "RUPE-C2J9RK6Z", fechaHora: "2026-09-28T11:05:00Z", direccionAproximada: "Calle Reservada Roja 18", coloniaZona: "Del Carmen", latitud: 19.3402, longitud: -99.1771, alcaldia: "Coyoacán", estadosAnimal: [ILESO, CLINICA, DOCIL], fotografiaUrl: FOTO },
];

export const esFallecido = (a: Pick<Avistamiento, "estadosAnimal">) => a.estadosAnimal.includes(FALLECIDO);

/** Estados elegidos agrupados por categoría del catálogo, en el orden del catálogo (para mostrarlos como chips). */
export function estadosPorCategoria(nombres: readonly string[]): Record<number, string[]> {
  const grupos: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const e of ESTADOS_ANIMAL) if (nombres.includes(e.nombre)) grupos[e.idCategoria].push(e.nombre);
  return grupos;
}

// Coherencia con las reglas del catálogo (R3): se comprueba al cargar en desarrollo.
if (process.env.NODE_ENV !== "production") {
  const ids = new Set<number>();
  for (const a of AVISTAMIENTOS) {
    if (ids.has(a.id)) throw new Error(`Avistamiento duplicado: ${a.id}`);
    ids.add(a.id);
    const grupos = estadosPorCategoria(a.estadosAnimal);
    const sel: SeleccionEstadoAnimal = { ...SELECCION_VACIA };
    for (const e of ESTADOS_ANIMAL) if (a.estadosAnimal.includes(e.nombre)) sel[e.idCategoria] = [...sel[e.idCategoria], e.id];
    const excluyentes = ESTADOS_ANIMAL.filter((e) => e.excluyente && a.estadosAnimal.includes(e.nombre)).length;
    const otros = grupos[1].length - excluyentes;
    if (Object.keys(erroresEstadoAnimal(sel)).length) throw new Error(`Avistamiento ${a.id}: faltan estados obligatorios`);
    if (excluyentes > 1 || (excluyentes === 1 && otros > 0)) throw new Error(`Avistamiento ${a.id}: «Ileso», «Fallecido» y «No se puede determinar» solo pueden elegirse solos`);
    if (a.estadosAnimal.includes(FALLECIDO) && grupos[3].length) throw new Error(`Avistamiento ${a.id}: «Fallecido» no admite Conducta`);
    if (grupos[2].length !== 1 || grupos[3].length > 1 || grupos[4].length > 1) throw new Error(`Avistamiento ${a.id}: reglas de selección única incumplidas`);
  }
}
