"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BotonIcono } from "@/components/ui/BotonIcono";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { VERSION_AVISO_PRIVACIDAD } from "@/mocks/sesion";
import { EnlaceSaltar } from "./EnlaceSaltar";
import { EnlacesNavegacion } from "./EnlacesNavegacion";
import { hrefActivo } from "./navegacion";
import { PieSitio } from "./PieSitio";

type EnlaceMenu = { href: string; etiqueta: string; icono: NombreIcono };

const CUENTA: EnlaceMenu[] = [
  { href: "/iniciar-sesion", etiqueta: "Iniciar sesión", icono: "login" },
  { href: "/registro", etiqueta: "Registrarse como persona tutora", icono: "person_add" },
];
const EXPLORAR: EnlaceMenu[] = [
  { href: "/", etiqueta: "Inicio", icono: "home" },
  { href: "/#como-funciona", etiqueta: "¿Cómo funciona RUPE?", icono: "info" },
  { href: "/consultar-folio", etiqueta: "Consultar folio", icono: "search" },
  { href: "/preguntas-frecuentes", etiqueta: "Preguntas frecuentes", icono: "help" },
  { href: "/aviso-de-privacidad", etiqueta: `Aviso de privacidad ${VERSION_AVISO_PRIVACIDAD}`, icono: "lock" },
  { href: "/contacto", etiqueta: "Contacto", icono: "mail" },
];
const NAVEGACION_ESCRITORIO = EXPLORAR.slice(0, 3);

type Props = {
  children: ReactNode;
  /** Estado del menú móvil al cargar (las capturas lo usan abierto). */
  menuAbiertoInicial?: boolean;
  /** Ítem activo; si no se da, se deduce de la ruta. */
  rutaActiva?: string;
};

/**
 * PLT-PUB (Visitante): encabezado con logotipo, tema y menú; en móvil el menú es un panel bajo el encabezado
 * con los grupos «Cuenta» y «Explorar»; desde 768 px «Iniciar sesión» y «Registrarse» van en el encabezado y,
 * desde 1024 px, también la navegación.
 */
export function PlantillaPublica({ children, menuAbiertoInicial = false, rutaActiva }: Props) {
  const pathname = usePathname();
  const activo = rutaActiva ?? hrefActivo(NAVEGACION_ESCRITORIO.map((e) => e.href), pathname);
  const [abierto, setAbierto] = useState(menuAbiertoInicial);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    }
    // Al pasar a escritorio el menú móvil ya no existe: se cierra para no dejar la página inerte.
    const escritorio = window.matchMedia("(min-width: 1024px)");
    const alCambiar = () => escritorio.matches && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    escritorio.addEventListener("change", alCambiar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      escritorio.removeEventListener("change", alCambiar);
    };
  }, [abierto]);

  function grupo(titulo: string, enlaces: EnlaceMenu[], clases?: string) {
    return (
      <section aria-labelledby={`menu-${titulo}`} className={clases}>
        <h2 id={`menu-${titulo}`} className="bg-surface-raised px-4 py-2 text-caption font-bold uppercase tracking-wide text-text-muted">
          {titulo}
        </h2>
        <ul>
          {enlaces.map((e) => (
            <li key={e.href} className="border-b border-border">
              <Link
                href={e.href}
                onClick={() => setAbierto(false)}
                className="flex min-h-14 items-center justify-between gap-3 px-4 text-body font-semibold hover:bg-primary-soft"
              >
                {e.etiqueta}
                <Icono nombre={e.icono} className="text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <EnlaceSaltar />
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 md:px-8">
          <Link href="/" aria-label="RUPE, inicio" className="inline-flex h-tactil items-center rounded-campo">
            <Logo variante="horizontal" ancho={104} />
          </Link>
          <EnlacesNavegacion enlaces={NAVEGACION_ESCRITORIO} activo={activo} etiqueta="Navegación principal" className="ml-4 hidden flex-1 lg:block" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle compacto />
            <Link href="/iniciar-sesion" className={clasesBoton({ variante: "secundario", className: "whitespace-nowrap max-md:hidden" })}>
              Iniciar sesión
            </Link>
            <Link href="/registro" className={clasesBoton({ className: "whitespace-nowrap max-md:hidden" })}>
              Registrarse
            </Link>
            <BotonIcono
              ref={boton}
              icono={abierto ? "close" : "menu"}
              etiqueta={abierto ? "Cerrar menú" : "Menú"}
              aria-expanded={abierto}
              aria-controls="menu-movil"
              onClick={() => setAbierto((a) => !a)}
              className="lg:hidden"
            />
          </div>
        </div>
        {abierto && (
          <div ref={panel} id="menu-movil" className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-surface shadow-lg lg:hidden">
            <nav aria-label="Menú">
              {grupo("Cuenta", CUENTA, "md:hidden")}
              {grupo("Explorar", EXPLORAR)}
            </nav>
          </div>
        )}
      </header>
      {abierto && <div aria-hidden="true" onClick={() => setAbierto(false)} className="fixed inset-0 top-16 z-30 bg-black/50 lg:hidden" />}
      <main id="contenido" tabIndex={-1} inert={abierto} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none! md:px-8">
        {children}
      </main>
      <PieSitio inert={abierto} />
    </div>
  );
}
