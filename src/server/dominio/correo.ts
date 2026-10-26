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
