import type { NombreIcono } from "@/components/ui/Icono";

export type EnlaceNavegacion = { href: string; etiqueta: string };
export type EnlaceConIcono = EnlaceNavegacion & { icono: NombreIcono };
export type GrupoNavegacion = { titulo: string; enlaces: EnlaceNavegacion[] };

/** Persona tutora (PLT-TUT): barra inferior en móvil y encabezado en escritorio. */
export const ITEMS_TUTOR: EnlaceConIcono[] = [
  { href: "/tutor", etiqueta: "Mis registros", icono: "pets" },
  { href: "/tutor/registrar", etiqueta: "Registrar extravío", icono: "add_circle" },
  { href: "/tutor/consultar-folio", etiqueta: "Consultar folio", icono: "search" },
];

/** Administrador (PLT-ADM): grupos del cajón lateral (móvil) y de la barra lateral (escritorio). */
export const GRUPOS_ADMIN: GrupoNavegacion[] = [
  {
    titulo: "Resumen",
    enlaces: [
      { href: "/admin", etiqueta: "Tablero" },
      { href: "/admin/reportes", etiqueta: "Reportes" },
    ],
  },
  {
    titulo: "Moderación",
    enlaces: [
      { href: "/admin/registros", etiqueta: "Registros" },
      { href: "/admin/avistamientos", etiqueta: "Avistamientos" },
    ],
  },
  { titulo: "Usuarios", enlaces: [{ href: "/admin/usuarios", etiqueta: "Usuarios" }] },
  {
    titulo: "Catálogos",
    enlaces: [
      { href: "/admin/alcaldias", etiqueta: "Alcaldías" },
      { href: "/admin/razas", etiqueta: "Razas" },
      { href: "/admin/motivos", etiqueta: "Motivos de extravío" },
      { href: "/admin/estados-animal", etiqueta: "Estados del animal" },
      { href: "/admin/estados-caso", etiqueta: "Estados del caso" },
    ],
  },
  {
    titulo: "Sistema",
    enlaces: [
      { href: "/admin/parametros", etiqueta: "Parámetros" },
      { href: "/admin/bitacora", etiqueta: "Bitácora de acciones" },
    ],
  },
];

/** href activo para una ruta: el más largo que la contenga (o igual). Sin coincidencia, cadena vacía. */
export function hrefActivo(hrefs: string[], ruta: string | null | undefined): string {
  if (!ruta) return "";
  return hrefs
    .filter((h) => !h.includes("#") && (ruta === h || ruta.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0] ?? "";
}
