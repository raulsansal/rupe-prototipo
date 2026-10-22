import { ALCALDIAS, FUERA_DE_LA_CIUDAD, type Alcaldia, type AlcaldiaAvistamiento } from "@/mocks/tipos";
import { alcaldiaDeCoordenadas, coordenadasSugeridas, type Coordenadas } from "@/mocks/geografia";
import { erroresEstadoAnimal, SELECCION_VACIA, type SeleccionEstadoAnimal } from "@/lib/estadoAnimal";

export const PASOS_AVISTAMIENTO = ["Inicio", "Fotografía", "Ubicación", "Fecha y estado", "Comentario", "Confirmar"];
export const TITULOS_PASO = [
  "Reportar un avistamiento",
  "Fotografía del perro",
  "¿Dónde lo viste?",
  "Fecha, hora y estado del animal",
  "Comentario",
  "Confirma tu reporte",
];

export type FormaUbicacion = "direccion" | "mapa" | "gps";
/** Estado de la lectura de «Usar mi ubicación». */
export type EstadoGps = "inicial" | "cargando" | "obtenida" | "denegada" | "error";

/** Lo que la persona va capturando; vive solo en memoria mientras dura el flujo. */
export type DatosAvistamiento = {
  fotoUrl?: string;
  forma: FormaUbicacion;
  direccion: string;
  alcaldiaElegida: Alcaldia | "";
  punto?: Coordenadas;
  confirmado: boolean;
  estadoGps: EstadoGps;
  /** Metros; solo con GPS. */
  precisionGps?: number;
  colonia: string;
  referencias: string;
  fecha: string;
  hora: string;
  estados: SeleccionEstadoAnimal;
  comentario: string;
};

export const DATOS_VACIOS: DatosAvistamiento = {
  forma: "direccion",
  direccion: "",
  alcaldiaElegida: "",
  confirmado: false,
  estadoGps: "inicial",
  colonia: "",
  referencias: "",
  fecha: "",
  hora: "",
  estados: SELECCION_VACIA,
  comentario: "",
};

export const LIMITES_TEXTO = { direccion: 200, colonia: 100, referencias: 500, comentario: 300 } as const;

export type Errores = Partial<Record<"foto" | "direccion" | "alcaldia" | "punto" | "fecha" | "hora" | "cat1" | "cat2", string>>;

/** Alcaldía del punto confirmado (la que se guarda, R14). */
export const alcaldiaDelPunto = (d: DatosAvistamiento): AlcaldiaAvistamiento | undefined => (d.punto ? alcaldiaDeCoordenadas(d.punto) : undefined);

const dosDigitos = (n: number) => String(n).padStart(2, "0");
/** Fecha local de hoy como AAAA-MM-DD, para el atributo max del campo de fecha. */
export function hoyLocal(ahora = new Date()): string {
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}

/** Valida un paso (1 a 6); vacío si todo está bien. El paso 6 no tiene campos propios. */
export function validarPaso(paso: number, d: DatosAvistamiento, ahora = new Date()): Errores {
  const e: Errores = {};
  if (paso === 2 && !d.fotoUrl) e.foto = "La fotografía es obligatoria. Toma o elige una foto del perro.";
  if (paso === 3) {
    if (d.forma === "direccion") {
      if (!d.direccion.trim()) e.direccion = "Escribe una dirección aproximada.";
      if (!d.alcaldiaElegida) e.alcaldia = "Elige una alcaldía.";
    }
    if (!d.punto || !d.confirmado) {
      e.punto =
        d.forma === "direccion"
          ? "Confirma el punto en el mapa para continuar."
          : d.forma === "mapa"
            ? "Marca un punto en el mapa y confírmalo para continuar."
            : "Usa tu ubicación actual para continuar, o elige otra forma de ubicar.";
    }
  }
  if (paso === 4) {
    if (!d.fecha) e.fecha = "Elige la fecha en que lo viste.";
    if (!d.hora) e.hora = "Elige la hora en que lo viste.";
    if (d.fecha && d.hora && new Date(`${d.fecha}T${d.hora}`) > ahora) e.hora = "La fecha y la hora no pueden ser posteriores a este momento.";
    const cat = erroresEstadoAnimal(d.estados);
    if (cat[1]) e.cat1 = cat[1];
    if (cat[2]) e.cat2 = cat[2];
  }
  return e;
}

/** Punto sugerido para una dirección escrita (maqueta). */
export const puntoSugerido = (alcaldia: Alcaldia): Coordenadas => coordenadasSugeridas(alcaldia);

export const ALCALDIAS_OPCIONES = ALCALDIAS.map((a) => ({ valor: a, etiqueta: a }));
export { FUERA_DE_LA_CIUDAD };

export const NOMBRE_FORMA: Record<FormaUbicacion, string> = { direccion: "Escribir dirección", mapa: "Marcar en mapa", gps: "Usar mi ubicación" };

export const formatoCoordenada = (n: number) => n.toFixed(6).replace("-", "−");
