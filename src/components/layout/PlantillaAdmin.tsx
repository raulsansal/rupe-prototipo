"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BotonIcono } from "@/components/ui/BotonIcono";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { SesionAdmin } from "@/mocks/sesion";
import { EnlaceSaltar } from "./EnlaceSaltar";
import { MenuCuenta } from "./MenuCuenta";
import { NavegacionAdmin } from "./NavegacionAdmin";
import { GRUPOS_ADMIN, hrefActivo } from "./navegacion";
import { PieSitio } from "./PieSitio";

type Props = {
  children: ReactNode;
  sesion: SesionAdmin;
  /** href del ítem activo; si no se da, se deduce de la ruta. */
  itemActivo?: string;
  /** Estado del cajón lateral al cargar (las capturas lo usan abierto). */
  menuAbiertoInicial?: boolean;
};

/**
 * PLT-ADM (Administrador): sin barra inferior ni campana. En móvil, el menú es un cajón lateral que se abre
 * desde el ícono de menú; desde 1024 px, barra lateral con grupos. El encabezado muestra el avatar y la
 * etiqueta «Administrador».
 */
export function PlantillaAdmin({ children, sesion, itemActivo, menuAbiertoInicial = false }: Props) {
  const pathname = usePathname();
  const hrefs = GRUPOS_ADMIN.flatMap((g) => g.enlaces.map((e) => e.href));
  const activo = itemActivo ?? hrefActivo(hrefs, pathname);
  const [abierto, setAbierto] = useState(menuAbiertoInicial);
  const cajon = useRef<HTMLDialogElement>(null);

  // <dialog> modal: atrapa el foco, Escape lo cierra y el foco vuelve al botón de menú.
  useEffect(() => {
    const d = cajon.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  useEffect(() => {
    const escritorio = window.matchMedia("(min-width: 1024px)");
    const alCambiar = () => escritorio.matches && setAbierto(false);
    escritorio.addEventListener("change", alCambiar);
    return () => escritorio.removeEventListener("change", alCambiar);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <EnlaceSaltar />
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="flex h-16 w-full items-center gap-2 px-4 md:px-8">
          <Link href="/admin" aria-label="RUPE, tablero" className="inline-flex h-tactil items-center rounded-campo">
            <Logo variante="horizontal" ancho={104} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle compacto />
            <MenuCuenta nombre={sesion.nombre} rol={sesion.rol} hrefCerrarSesion="/" />
            <Etiqueta className="hidden lg:inline-flex">{sesion.rol}</Etiqueta>
            <BotonIcono
              icono="menu"
              etiqueta="Menú"
              aria-expanded={abierto}
              aria-controls="cajon-admin"
              onClick={() => setAbierto(true)}
              className="lg:hidden"
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
          <NavegacionAdmin grupos={GRUPOS_ADMIN} activo={activo} />
        </aside>
        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none! md:px-8">
          {children}
        </main>
      </div>
      <PieSitio />
      <dialog
        ref={cajon}
        id="cajon-admin"
        aria-label="Menú de administración"
        onClose={() => setAbierto(false)}
        onClick={(e) => e.target === cajon.current && setAbierto(false)}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface p-0 text-text backdrop:bg-black/50 open:flex open:flex-col"
      >
        <div className="flex items-center gap-3 border-b border-border bg-surface-raised p-4">
          <Avatar nombre={sesion.nombre} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <p className="text-small font-bold">{sesion.nombre}</p>
            <Etiqueta>{sesion.rol}</Etiqueta>
          </div>
          <BotonIcono icono="close" etiqueta="Cerrar menú" onClick={() => setAbierto(false)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavegacionAdmin grupos={GRUPOS_ADMIN} activo={activo} onNavegar={() => setAbierto(false)} etiqueta="Administración (menú)" />
        </div>
      </dialog>
    </div>
  );
}
