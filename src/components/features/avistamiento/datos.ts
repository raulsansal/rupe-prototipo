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

/** Lo que la persona va capturando; vive solo en memoria mientras dura el flujo. La ubicación del Prototipo es una dirección y una alcaldía (el mapa y el GPS llegan después). */
export type DatosAvistamiento = {
  fotoUrl?: string;
  /** La fotografía ya reducida en el navegador: es la que se envía. */
  foto?: Blob;
  direccion: string;
  /** Id de la alcaldía elegida del catálogo (texto; vacío si no se eligió). */
  alcaldiaElegida: string;
  colonia: string;
  referencias: string;
  fecha: string;
  hora: string;
  estados: SeleccionEstadoAnimal;
  comentario: string;
};

export const DATOS_VACIOS: DatosAvistamiento = { direccion: "", alcaldiaElegida: "", colonia: "", referencias: "", fecha: "", hora: "", estados: SELECCION_VACIA, comentario: "" };

export const LIMITES_TEXTO = { direccion: 200, colonia: 100, referencias: 500, comentario: 300 } as const;
export const NOTA_UBICACION_SIMULADA = "Ubicación aproximada simulada en el prototipo";

/** Opción activa del catálogo de estados del animal tal como la entrega el servidor. */
export type OpcionEstadoAnimal = { id: number; idCategoria: number; nombre: string; descripcion: string; excluyente: boolean };

/** Paso 5: invitación a dejar un correo cuando el animal está bajo resguardo de quien reporta (por id de «Contención y ubicación»). Es texto libre del comentario, no un campo nuevo. */
export const PLACEHOLDER_RESGUARDO = "Dado que tienes al animal en resguardo, te invitamos a agregar un correo electrónico para que la persona tutora se ponga en contacto contigo. Gracias por tu ayuda.";
export const NOTA_CORREO_RESGUARDO = "Este comentario lo verá la persona tutora. Si decides compartir un correo electrónico, será visible para ella; no incluyas otros datos personales.";

/** `cat3` y `cat4` son las categorías opcionales; `estados` es un error del paso entero cuando no se sabe en qué categoría está. */
export type Errores = Partial<Record<"foto" | "direccion" | "alcaldia" | "colonia" | "referencias" | "fecha" | "hora" | "cat1" | "cat2" | "cat3" | "cat4" | "estados" | "comentario", string>>;

const dosDigitos = (n: number) => String(n).padStart(2, "0");
/** Fecha local de hoy como AAAA-MM-DD, para el atributo max del campo de fecha. */
export function hoyLocal(ahora = new Date()): string {
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}

/** Valida un paso (1 a 6); vacío si todo está bien. El servidor repite estas reglas y es quien decide. */
export function validarPaso(paso: number, d: DatosAvistamiento, ahora = new Date()): Errores {
  const e: Errores = {};
  if (paso === 2 && !d.fotoUrl) e.foto = "La fotografía es obligatoria. Toma o elige una foto del perro.";
  if (paso === 3) {
    if (!d.direccion.trim()) e.direccion = "Escribe una dirección aproximada.";
    if (!d.alcaldiaElegida) e.alcaldia = "Elige una alcaldía.";
    if (d.colonia.length > LIMITES_TEXTO.colonia) e.colonia = `La colonia o zona no puede pasar de ${LIMITES_TEXTO.colonia} caracteres.`;
    if (d.referencias.length > LIMITES_TEXTO.referencias) e.referencias = `Las referencias no pueden pasar de ${LIMITES_TEXTO.referencias} caracteres.`;
  }
  if (paso === 4) {
    if (!d.fecha) e.fecha = "Elige la fecha en que lo viste.";
    if (!d.hora) e.hora = "Elige la hora en que lo viste.";
    if (d.fecha && d.hora && new Date(`${d.fecha}T${d.hora}`) > ahora) e.hora = "La fecha y la hora no pueden ser posteriores a este momento.";
    const cat = erroresEstadoAnimal(d.estados);
    if (cat[1]) e.cat1 = cat[1];
    if (cat[2]) e.cat2 = cat[2];
  }
  if (paso === 5 && d.comentario.length > LIMITES_TEXTO.comentario) e.comentario = `El comentario no puede pasar de ${LIMITES_TEXTO.comentario} caracteres.`;
  return e;
}

/** Paso del formulario al que pertenece cada campo que el servidor puede rechazar (para llevar a la persona a corregirlo). */
export const PASO_DEL_CAMPO: Record<string, number> = { foto: 2, direccion: 3, alcaldia: 3, coloniaZona: 3, referencias: 3, fecha: 4, hora: 4, estadosAnimal: 4, comentario: 5 };
/** Nombre del campo del servidor → clave de error de la pantalla. */
export const ERROR_DEL_CAMPO: Record<string, keyof Errores> = { foto: "foto", direccion: "direccion", alcaldia: "alcaldia", coloniaZona: "colonia", referencias: "referencias", fecha: "fecha", hora: "hora", estadosAnimal: "cat1", comentario: "comentario" };
