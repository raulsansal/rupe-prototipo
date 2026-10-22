import Link from "next/link";
import type { ReactNode } from "react";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { EnlaceIcono } from "@/components/ui/EnlaceIcono";
import { IndicadorPasos } from "@/components/ui/IndicadorPasos";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EnlaceSaltar } from "./EnlaceSaltar";
import { PieSitio } from "./PieSitio";

type AccionRegresar = { href?: string; onClick?: () => void; etiqueta?: string };
type AccionContinuar = { etiqueta?: string; type?: "button" | "submit"; onClick?: () => void; deshabilitado?: boolean; cargando?: boolean };

type Props = {
  /** Etiquetas de todos los pasos del flujo. */
  pasos: string[];
  /** Paso actual, de 1 a pasos.length. */
  pasoActual: number;
  /** Título del paso (encabezado h1 de la pantalla). */
  titulo: string;
  children: ReactNode;
  /** Botón «Regresar» al pie; se omite en el primer paso. */
  regresar?: AccionRegresar;
  continuar?: AccionContinuar;
  /** Destino del botón del encabezado (salir del flujo). */
  hrefSalir?: string;
};

/**
 * Plantilla de flujo por pasos (reporte de avistamiento del Visitante, registro de la persona tutora).
 * Es un componente, no un layout: varias pantallas de públicos distintos lo comparten. Sin barra inferior de
 * navegación y con pie mínimo.
 */
export function PlantillaFlujo({ pasos, pasoActual, titulo, children, regresar, continuar = {}, hrefSalir = "/" }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <EnlaceSaltar />
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-2 px-4">
          <Link href="/" aria-label="RUPE, inicio" className="inline-flex h-tactil items-center rounded-campo">
            <Logo variante="horizontal" ancho={104} />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle compacto />
            <EnlaceIcono href={hrefSalir} icono="arrow_back" etiqueta="Salir y regresar" contorno />
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 focus:outline-none!">
        <IndicadorPasos pasos={pasos} actual={pasoActual} />
        <h1 id="titulo-paso" tabIndex={-1} className="mt-4 text-h1 focus:outline-none!">
          {titulo}
        </h1>
        <div className="mt-4 flex-1">{children}</div>
        <div className="mt-8 flex gap-3">
          {regresar &&
            (regresar.href ? (
              <Link href={regresar.href} className={clasesBoton({ variante: "secundario", className: "flex-1" })}>
                {regresar.etiqueta ?? "Regresar"}
              </Link>
            ) : (
              <Boton variante="secundario" className="flex-1" onClick={regresar.onClick}>
                {regresar.etiqueta ?? "Regresar"}
              </Boton>
            ))}
          <Boton
            className="flex-1"
            type={continuar.type ?? "button"}
            onClick={continuar.onClick}
            disabled={continuar.deshabilitado}
            cargando={continuar.cargando}
          >
            {continuar.etiqueta ?? "Continuar"}
          </Boton>
        </div>
      </main>
      <PieSitio variante="minimo" contenedor="max-w-2xl" />
    </div>
  );
}
