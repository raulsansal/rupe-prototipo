import { formatoInvalido } from "../errores";

/** Lee el cuerpo JSON de una petición; 400 si no es JSON válido o es demasiado grande. */
export async function leerJson(peticion: Request): Promise<unknown> {
  const texto = await peticion.text();
  if (texto.length > 10_000) throw formatoInvalido("CUERPO_GRANDE", "La petición es demasiado grande.");
  try {
    return JSON.parse(texto);
  } catch {
    throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo de la petición no es JSON válido.");
  }
}
