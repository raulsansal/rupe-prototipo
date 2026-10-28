// Adapta la ficha pública (solo campos públicos) a lo que compone la hoja: el mismo texto de edad, tamaño y fecha que ve la persona en pantalla.
import type { FichaPublica } from "../../mocks/tipos";
import { formatearFechaLarga } from "../formato";
import { edadAproximada, etiquetaTamano } from "../perro";
import { contenidoDeFicha, type Bloque, type FichaParaHoja, type TamanoHoja } from "./composicion";

export function fichaParaHoja(f: FichaPublica): FichaParaHoja {
  return {
    nombre: f.nombre, sexo: f.sexo, raza: f.raza, edad: edadAproximada(f), tamano: etiquetaTamano(f.tamano), color: f.color,
    caracteristicasDistintivas: f.caracteristicasDistintivas, fechaExtravio: f.fechaExtravio, coloniaZona: f.coloniaZona, alcaldia: f.alcaldia, folio: f.folio,
  };
}

/** Bloques de la hoja (pantalla y PDF usan esta misma lista). */
export const bloquesDeFicha = (f: FichaPublica, dominio: string, tamano: TamanoHoja): Bloque[] => contenidoDeFicha(fichaParaHoja(f), formatearFechaLarga(f.fechaExtravio), dominio, tamano);
