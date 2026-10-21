import { PATRON_FOLIO, type Folio } from "./tipos";

/** Folios ficticios con formato válido, para maquetas. */
export const FOLIOS_EJEMPLO = ["RUPE-K7M4XQ9T", "RUPE-3HN8WD2B", "RUPE-Z5C6VR4P"] as const satisfies readonly Folio[];

if (process.env.NODE_ENV !== "production") {
  for (const folio of FOLIOS_EJEMPLO) {
    if (!PATRON_FOLIO.test(folio)) throw new Error(`Folio de ejemplo inválido: ${folio}`);
  }
}
