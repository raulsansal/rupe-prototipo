import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FOLIO_CON_AVISTAMIENTOS, FOLIO_UN_AVISTAMIENTO } from "@/mocks/avistamientos";
import { FOLIO_EN_CURSO } from "@/mocks/casos";

export const metadata: Metadata = { title: "Pantallas de la persona tutora · RUPE (solo desarrollo)" };

const CASO = `/tutor/casos/${FOLIO_EN_CURSO}`;
const CON_AV = `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}`;
const UN_AV = `/tutor/casos/${FOLIO_UN_AVISTAMIENTO}`;

const GRUPOS: { titulo: string; enlaces: [string, string][] }[] = [
  {
    titulo: "Acceso (maqueta, sin autenticación)",
    enlaces: [
      ["/acceso", "ACC-01 · formulario"],
      ["/acceso?estado=bloqueo", "ACC-01 · bloqueo temporal"],
      ["/acceso?estado=deshabilitada", "ACC-01 · cuenta deshabilitada"],
      ["/acceso?estado=aviso-actualizado", "TRA-03 · aviso actualizado"],
      ["/admin", "Entrar como Administrador (/admin)"],
    ],
  },
  {
    titulo: "ACC-02 y MOD-01 · Registro (?estado) y aviso de privacidad",
    enlaces: [
      ["/registro", "ACC-02 · formulario"],
      ["/registro?estado=aviso", "ACC-02 + MOD-01 · aviso completo"],
      ["/?aviso=abierto", "PUB-01 + MOD-01 · solo lectura"],
    ],
  },
  {
    titulo: "TUT-01 · Mis registros (?estado)",
    enlaces: [
      ["/tutor", "Con registros"],
      ["/tutor?estado=vacio", "Sin registros"],
      ["/tutor?estado=cargando", "Cargando"],
    ],
  },
  {
    titulo: "TUT-02 y TUT-03 · Registrar extravío (?paso, ?raza)",
    enlaces: [
      ["/tutor/registrar", "Paso 1 · datos del perro"],
      ["/tutor/registrar?raza=otra", "Paso 1 · raza «Otra» con foto"],
      ["/tutor/registrar?paso=2", "Paso 2 · circunstancias"],
    ],
  },
  { titulo: "TUT-04 · Registro creado", enlaces: [[`${CASO}/creado`, "Registro creado"]] },
  {
    titulo: "TUT-05 · Detalle del caso (?estado)",
    enlaces: [
      [`${CASO}?estado=en-curso`, "A · en curso"],
      [`${CASO}?estado=localizado`, "B · localizado"],
      [`${CASO}?estado=cerrado`, "C · cerrado"],
    ],
  },
  {
    titulo: "TUT-08, TUT-09 y TUT-10 · Avistamientos (?filtros, ?ruta, ?foto)",
    enlaces: [
      [`${CASO}/avistamientos`, "TUT-08 · sin avistamientos"],
      [`${CON_AV}/avistamientos`, "TUT-08 · con avistamientos"],
      [`${CON_AV}/avistamientos?filtros=abiertos`, "TUT-08 · filtros desplegados"],
      [`${CON_AV}/mapa`, "TUT-09 · mapa"],
      [`${CON_AV}/mapa?ruta=visible`, "TUT-09 · con ruta"],
      [`${UN_AV}/mapa`, "TUT-09 · un avistamiento (sin ruta)"],
      [`${CON_AV}/avistamientos/101`, "TUT-10 · normal"],
      [`${CON_AV}/avistamientos/102`, "TUT-10 · «Fallecido», foto oculta"],
      [`${CON_AV}/avistamientos/102?foto=visible`, "TUT-10 · «Fallecido», foto mostrada"],
    ],
  },
  {
    titulo: "TRA-02 · Sesión expirada",
    enlaces: [["/dev/transversales/sesion-expirada", "TRA-02 sobre «Mis registros»"]],
  },
  {
    titulo: "TUT-07 · Ficha de búsqueda (?modal, ?hoja)",
    enlaces: [
      [`${CASO}/ficha`, "Vista previa"],
      [`${CASO}/ficha?modal=visor`, "Visor · Carta"],
      [`${CASO}/ficha?modal=visor&hoja=media-carta`, "Visor · Media carta"],
      [`${CASO}/ficha?modal=compartir`, "MOD-07 · Compartir"],
      [`${CASO}/ficha?modal=regenerar`, "MOD-06 · Regenerar QR"],
    ],
  },
];

export default function PantallasTutor() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Pantallas de la persona tutora</h1>
          <p className="text-small text-text-muted">Bloque 4 · variantes de desarrollo; no forman parte del sitio.</p>
        </div>
        <ThemeToggle />
      </header>
      <div className="mt-6 flex flex-col gap-6">
        {GRUPOS.map((g) => (
          <section key={g.titulo} aria-labelledby={g.titulo}>
            <h2 id={g.titulo} className="text-h3 font-semibold">
              {g.titulo}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {g.enlaces.map(([href, texto]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex h-tactil items-center rounded-boton border border-border bg-surface px-4 text-small font-semibold text-primary hover:border-border-strong">
                    {texto}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
