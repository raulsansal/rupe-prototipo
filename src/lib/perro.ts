import type { FichaPublica } from "@/mocks/tipos";

const TAMANO = { pequeño: "Pequeño", mediano: "Mediano", grande: "Grande" } as const;

export const etiquetaTamano = (t: FichaPublica["tamano"]) => TAMANO[t];

/** «4 años», «1 mes», «Menos de 1 mes». */
export function edadAproximada({ edadValor, edadUnidad }: Pick<FichaPublica, "edadValor" | "edadUnidad">): string {
  if (edadUnidad === "meses") return edadValor === 0 ? "Menos de 1 mes" : `${edadValor} ${edadValor === 1 ? "mes" : "meses"}`;
  return `${edadValor} ${edadValor === 1 ? "año" : "años"}`;
}
