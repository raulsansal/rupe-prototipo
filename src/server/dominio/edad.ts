// Edad aproximada del perro (CHECK del diccionario): meses 0–11 («menos de 1 mes» se guarda como 0) o años 1–50.
export type UnidadEdad = "meses" | "años";

export function edadValida(valor: unknown, unidad: unknown): valor is number {
  if (typeof valor !== "number" || !Number.isInteger(valor)) return false;
  return (unidad === "meses" && valor >= 0 && valor <= 11) || (unidad === "años" && valor >= 1 && valor <= 50);
}

/** «menos de 1 mes», «1 mes», «7 meses», «1 año», «4 años»: nunca «0 meses». */
export function textoDeEdad(valor: number, unidad: UnidadEdad): string {
  if (unidad === "meses") return valor === 0 ? "menos de 1 mes" : valor === 1 ? "1 mes" : `${valor} meses`;
  return valor === 1 ? "1 año" : `${valor} años`;
}
