"use client";

import Link from "next/link";
import { cx } from "@/lib/clases";
import { IconoRedSocial } from "./IconoRedSocial";
import { useEtiquetaVersionAviso } from "./VersionAviso";

type Props = {
  /** completo: enlaces y redes; minimo: solo los enlaces (plantilla de flujo). */
  variante?: "completo" | "minimo";
  /** Vuelve el pie inerte (p. ej. con el menú móvil abierto). */
  inert?: boolean;
  /** Clases del contenedor central; por defecto el ancho del sitio. */
  contenedor?: string;
  className?: string;
};

const enlaces = (etiquetaAviso: string) => [
  { href: "/#aviso-de-privacidad", etiqueta: etiquetaAviso },
  { href: "/#preguntas-frecuentes", etiqueta: "Preguntas frecuentes" },
  { href: "/#contacto", etiqueta: "Contacto" },
];

// Páginas de inicio de cada red: aún no hay cuentas oficiales de RUPE.
const REDES = [
  { red: "facebook", nombre: "Facebook", href: "https://www.facebook.com/" },
  { red: "x", nombre: "X", href: "https://x.com/" },
  { red: "instagram", nombre: "Instagram", href: "https://www.instagram.com/" },
] as const;

export function PieSitio({ variante = "completo", inert, contenedor = "max-w-7xl md:px-8", className }: Props) {
  const ENLACES = enlaces(`Aviso de privacidad ${useEtiquetaVersionAviso()}`); // la versión VIGENTE del parámetro
  return (
    <footer inert={inert} className={cx("border-t border-border bg-surface", className)}>
      <div className={cx("mx-auto flex w-full flex-col gap-2 px-4 py-4", contenedor)}>
        <nav aria-label="Información del sitio">
          <ul className="flex flex-wrap gap-x-6">
            {ENLACES.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="inline-flex h-tactil items-center whitespace-nowrap text-small font-semibold hover:underline">
                  {e.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {variante === "completo" && (
          <ul aria-label="Redes sociales" className="flex gap-3">
            {REDES.map((r) => (
              <li key={r.red}>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`RUPE en ${r.nombre} (se abre en una pestaña nueva)`}
                  className="borde-campo inline-flex size-tactil items-center justify-center rounded-boton border-border bg-background text-text hover:bg-primary-soft"
                >
                  <IconoRedSocial red={r.red} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
