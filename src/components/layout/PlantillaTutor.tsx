"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarraNavegacionInferior } from "@/components/ui/BarraNavegacionInferior";
import { EnlaceIcono } from "@/components/ui/EnlaceIcono";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { SesionTutor } from "@/mocks/sesion";
import { EnlaceSaltar } from "./EnlaceSaltar";
import { EnlacesNavegacion } from "./EnlacesNavegacion";
import { MenuCuenta } from "./MenuCuenta";
import { hrefActivo, ITEMS_TUTOR } from "./navegacion";
import { PieSitio } from "./PieSitio";

type Props = {
  children: ReactNode;
  sesion: SesionTutor;
  /** href del ítem activo; si no se da, se deduce de la ruta. */
  itemActivo?: string;
  /** Solo demostración: abre el menú de cuenta al cargar. */
  cuentaAbiertaInicial?: boolean;
};

/**
 * PLT-TUT (persona tutora): sin imagen principal. En móvil, barra superior y barra inferior de navegación;
 * desde 768 px la navegación va en el encabezado. Incluye la campana de avistamientos y el menú de cuenta.
 */
export function PlantillaTutor({ children, sesion, itemActivo, cuentaAbiertaInicial }: Props) {
  const pathname = usePathname();
  const hrefs = ITEMS_TUTOR.map((i) => i.href);
  const activo = itemActivo ?? hrefActivo(hrefs, pathname);
  return (
    <div className="flex min-h-dvh flex-col">
      <EnlaceSaltar />
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 md:px-8">
          <Link href="/tutor" aria-label="RUPE, mis registros" className="inline-flex h-tactil items-center rounded-campo">
            <Logo variante="horizontal" ancho={104} />
          </Link>
          <EnlacesNavegacion enlaces={ITEMS_TUTOR} activo={activo} etiqueta="Navegación principal" className="ml-2 hidden md:block" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle compacto />
            <EnlaceIcono href="/tutor/avistamientos" icono="notifications" etiqueta="Avistamientos" insignia={sesion.avisosNuevos} />
            <MenuCuenta nombre={sesion.nombre} hrefCerrarSesion="/" abiertoInicial={cuentaAbiertaInicial} />
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none! md:px-8">
        {children}
      </main>
      <PieSitio />
      <BarraNavegacionInferior
        items={ITEMS_TUTOR}
        activo={activo}
        etiqueta="Navegación inferior"
        className="sticky bottom-0 z-40 rounded-none border-x-0 border-b-0 md:hidden"
      />
    </div>
  );
}
