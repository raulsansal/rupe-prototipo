import { cuerpoDemasiadoGrande, formatoInvalido } from "../errores";

/**
 * Lee el cuerpo de una petición SIN pasar de `maximo` bytes: rechaza con 413 por la cabecera Content-Length antes de leer nada y, como esa cabecera puede mentir
 * o faltar (transferencia por trozos), cuenta también los bytes que llegan y corta la lectura en cuanto se excede.
 */
export async function leerCuerpoAcotado(peticion: Request, maximo: number): Promise<Uint8Array> {
  const declarado = peticion.headers.get("content-length");
  if (declarado !== null && (!/^\d+$/.test(declarado) || Number(declarado) > maximo)) throw cuerpoDemasiadoGrande();
  if (!peticion.body) return new Uint8Array();
  const lector = peticion.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel().catch(() => undefined);
      throw cuerpoDemasiadoGrande();
    }
    trozos.push(value);
  }
  const todo = new Uint8Array(total);
  let desplazamiento = 0;
  for (const t of trozos) {
    todo.set(t, desplazamiento);
    desplazamiento += t.byteLength;
  }
  return todo;
}

/** Lee un cuerpo multipart/form-data acotado; 400 si no lo es o está mal formado. */
export async function leerFormularioAcotado(peticion: Request, maximo: number): Promise<FormData> {
  const tipo = peticion.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(tipo)) throw formatoInvalido("CUERPO_INVALIDO", "La petición debe enviarse como formulario con fotografía.");
  const bytes = await leerCuerpoAcotado(peticion, maximo);
  try {
    return await new Response(bytes as BodyInit, { headers: { "content-type": tipo } }).formData();
  } catch {
    throw formatoInvalido("CUERPO_INVALIDO", "El formulario enviado no es válido.");
  }
}
