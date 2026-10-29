// Vista previa del correo con el folio (HU 013, regla 3). NO se envía ningún correo ni se guarda: se arma al mostrar la confirmación. Lleva solo lo necesario
// (nombre de pila, folio y datos públicos del perro): sin token del QR, sin correo ni teléfono, sin datos reservados del extravío.
import { textoDeEdad, type UnidadEdad } from "./edad";

export type CorreoVistaPrevia = { asunto: string; cuerpo: string[] };

export function vistaPreviaDeCorreo(e: { nombreDeLaPersona: string; folio: string; nombreDelPerro: string; edadValor: number; edadUnidad: UnidadEdad }): CorreoVistaPrevia {
  const pila = e.nombreDeLaPersona.trim().split(/\s+/)[0] ?? "";
  return {
    asunto: `Tu folio de RUPE: ${e.folio}`,
    cuerpo: [
      `Hola, ${pila}.`,
      `Registramos a ${e.nombreDelPerro} (${textoDeEdad(e.edadValor, e.edadUnidad)}) en RUPE. Su folio de consulta es ${e.folio}.`,
      "Guárdalo: con él puedes consultar el estatus de tu caso. Tus datos personales y las circunstancias del extravío permanecen reservados.",
      "Este mensaje es una vista previa dentro de la aplicación: en el Prototipo no se envía ningún correo.",
    ],
  };
}

/**
 * Aviso simulado de un nuevo avistamiento (HU 036). NO se envía ningún correo. Lleva el folio, el nombre del perro y el resumen del estado del animal; nunca el contacto de
 * quien reportó (es anónimo), la dirección, las referencias, la foto ni el token del QR. Si el avistamiento incluye «Fallecido», ni el asunto ni el cuerpo mencionan el estado
 * del animal: solo avisan de un nuevo avistamiento e invitan a iniciar sesión.
 */
export function correoDeAvistamiento(e: { nombreDeLaPersona: string; folio: string; nombreDelPerro: string; estadosAnimal: readonly string[]; fallecido: boolean }): CorreoVistaPrevia {
  const pila = e.nombreDeLaPersona.trim().split(/\s+/)[0] ?? "";
  const asunto = `Nuevo avistamiento de tu caso ${e.folio}`;
  if (e.fallecido) {
    return {
      asunto,
      cuerpo: [`Hola, ${pila}.`, `Recibimos un nuevo avistamiento de ${e.nombreDelPerro} (folio ${e.folio}).`, "Inicia sesión en RUPE para consultar el detalle."],
    };
  }
  return {
    asunto,
    cuerpo: [
      `Hola, ${pila}.`,
      `Recibimos un nuevo avistamiento de ${e.nombreDelPerro} (folio ${e.folio}).`,
      `Estado del animal reportado: ${e.estadosAnimal.join(", ")}.`,
      "Inicia sesión en RUPE para ver la fotografía y la ubicación aproximada. Quien lo reportó es anónimo: no tenemos su contacto.",
    ],
  };
}
