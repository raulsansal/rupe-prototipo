"use client";

import { useSyncExternalStore } from "react";
import { CLAVE_TEMA, type Tema } from "@/lib/tema";
import { Icono } from "./Icono";

function suscribir(alCambiar: () => void) {
  const observador = new MutationObserver(alCambiar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observador.disconnect();
}

const temaActual = (): Tema => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const temaServidor = (): Tema => "light";

/** Solo para la fase de maquetado: alterna claro/oscuro, guarda la elección y la aplica en <html>. */
export function ThemeToggle() {
  const tema = useSyncExternalStore(suscribir, temaActual, temaServidor);
  const oscuro = tema === "dark";

  function alternar() {
    const siguiente: Tema = oscuro ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", siguiente);
    try {
      localStorage.setItem(CLAVE_TEMA, siguiente);
    } catch {
      // Sin almacenamiento disponible: el cambio aplica solo a esta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oscuro}
      aria-label="Modo oscuro"
      className="inline-flex h-boton items-center gap-2 rounded-boton border-[1.5px] border-primary bg-surface px-4 text-small font-semibold text-primary hover:bg-primary-soft active:bg-primary-soft"
    >
      <Icono nombre={oscuro ? "dark_mode" : "light_mode"} tamano={20} />
      Modo oscuro
    </button>
  );
}
