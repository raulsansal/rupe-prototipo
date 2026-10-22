// Geografía ILUSTRATIVA para la maqueta: no hay mapa real. El mapa dibujado cubre un rectángulo aproximado de la
// Ciudad de México y los centros de las alcaldías son aproximados; solo sirven para obtener latitud, longitud
// y alcaldía de un punto de la ilustración. En el Prototipo la alcaldía la determina el servidor (R14).
import type { Alcaldia, AlcaldiaAvistamiento } from "./tipos";
import { FUERA_DE_LA_CIUDAD } from "./tipos";

/** Rectángulo que cubre la ilustración del mapa. */
export const LIMITES = { norte: 19.6, sur: 19.0, oeste: -99.4, este: -98.9 } as const;

export type Punto = { x: number; y: number }; // 0 a 1 dentro de la ilustración, y hacia abajo
export type Coordenadas = { latitud: number; longitud: number };

export function puntoACoordenadas({ x, y }: Punto): Coordenadas {
  const redondear = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    latitud: redondear(LIMITES.norte - y * (LIMITES.norte - LIMITES.sur)),
    longitud: redondear(LIMITES.oeste + x * (LIMITES.este - LIMITES.oeste)),
  };
}

export function coordenadasAPunto({ latitud, longitud }: Coordenadas): Punto {
  return {
    x: (longitud - LIMITES.oeste) / (LIMITES.este - LIMITES.oeste),
    y: (LIMITES.norte - latitud) / (LIMITES.norte - LIMITES.sur),
  };
}

const CENTROS: Record<Alcaldia, Coordenadas> = {
  "Álvaro Obregón": { latitud: 19.36, longitud: -99.22 },
  Azcapotzalco: { latitud: 19.49, longitud: -99.19 },
  "Benito Juárez": { latitud: 19.38, longitud: -99.16 },
  Coyoacán: { latitud: 19.34, longitud: -99.16 },
  "Cuajimalpa de Morelos": { latitud: 19.36, longitud: -99.3 },
  Cuauhtémoc: { latitud: 19.44, longitud: -99.15 },
  "Gustavo A. Madero": { latitud: 19.5, longitud: -99.11 },
  Iztacalco: { latitud: 19.39, longitud: -99.1 },
  Iztapalapa: { latitud: 19.35, longitud: -99.06 },
  "La Magdalena Contreras": { latitud: 19.31, longitud: -99.25 },
  "Miguel Hidalgo": { latitud: 19.42, longitud: -99.2 },
  "Milpa Alta": { latitud: 19.19, longitud: -99.02 },
  Tláhuac: { latitud: 19.27, longitud: -99.0 },
  Tlalpan: { latitud: 19.25, longitud: -99.17 },
  "Venustiano Carranza": { latitud: 19.43, longitud: -99.09 },
  Xochimilco: { latitud: 19.26, longitud: -99.1 },
};

const RADIO_MAXIMO = 0.1; // grados: más lejos del centro más cercano ya cuenta como fuera de la ciudad

const distancia = (a: Coordenadas, b: Coordenadas) => Math.hypot(a.latitud - b.latitud, a.longitud - b.longitud);

/** Alcaldía del centro más cercano (aproximación de la maqueta); lejos de todos, «Fuera de la Ciudad de México» (R14). */
export function alcaldiaDeCoordenadas(c: Coordenadas): AlcaldiaAvistamiento {
  let mejor: Alcaldia | undefined;
  let menor = Infinity;
  for (const [nombre, centro] of Object.entries(CENTROS) as [Alcaldia, Coordenadas][]) {
    const d = distancia(c, centro);
    if (d < menor) {
      menor = d;
      mejor = nombre;
    }
  }
  return mejor && menor <= RADIO_MAXIMO ? mejor : FUERA_DE_LA_CIUDAD;
}

/** Punto sugerido para una dirección escrita: el centro de la alcaldía elegida, con un pequeño desplazamiento fijo. */
export function coordenadasSugeridas(alcaldia: Alcaldia): Coordenadas {
  const c = CENTROS[alcaldia];
  return { latitud: Math.round((c.latitud + 0.004) * 1e6) / 1e6, longitud: Math.round((c.longitud - 0.003) * 1e6) / 1e6 };
}

/** Lectura de «Usar mi ubicación» en la maqueta cuando el navegador entrega una posición fuera de la ilustración. */
export function dentroDeLaIlustracion({ latitud, longitud }: Coordenadas): boolean {
  return latitud >= LIMITES.sur && latitud <= LIMITES.norte && longitud >= LIMITES.oeste && longitud <= LIMITES.este;
}
