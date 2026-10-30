"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Versión por omisión (valor por defecto del parámetro): la galería de componentes y cualquier árbol sin proveedor. */
const VERSION_POR_OMISION = "1.0";
const Contexto = createContext<string>(VERSION_POR_OMISION);

/** Etiqueta con que se muestra una versión del aviso: «v1.0». */
export const etiquetaDeVersion = (version: string) => `v${version}`;

/**
 * Entrega a los componentes de cliente la versión vigente del aviso (la lee el layout raíz del parámetro `version_aviso_privacidad`). Así el pie, el menú, el aviso completo y el modal de
 * re-aceptación muestran la versión REAL sin que cada pantalla la pida.
 */
export function ProveedorVersionAviso({ version, children }: { version: string; children: ReactNode }) {
  return <Contexto.Provider value={version}>{children}</Contexto.Provider>;
}

/** «v2.0»: la etiqueta de la versión vigente del aviso. */
export const useEtiquetaVersionAviso = () => etiquetaDeVersion(useContext(Contexto));
