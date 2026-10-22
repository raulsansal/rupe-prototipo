import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FOLIO_EN_CURSO, FOLIO_INEXISTENTE } from "@/mocks/casos";

export const metadata: Metadata = { title: "Pantallas del Visitante · RUPE (solo desarrollo)" };

const FICHA = `/ficha/${FOLIO_EN_CURSO}`;
const AVISTAMIENTO = `${FICHA}/avistamiento`;

const GRUPOS: { titulo: string; enlaces: [string, string][] }[] = [
  { titulo: "PUB-01 · Página principal", enlaces: [["/", "/"]] },
  {
    titulo: "PUB-03 · Ficha pública (?estado)",
    enlaces: [
      [`${FICHA}?estado=en-curso`, "A · en curso"],
      [`${FICHA}?estado=localizado`, "B · localizado"],
      [`${FICHA}?estado=no-disponible`, "C · caso no disponible"],
      [`/ficha/${FOLIO_INEXISTENTE}`, "C · folio no encontrado"],
    ],
  },
  {
    titulo: "PUB-05 · Reporte de avistamiento (?paso, ?datos)",
    enlaces: [1, 2, 3, 4, 5, 6].map((n): [string, string] => [`${AVISTAMIENTO}?paso=${n}${n === 6 ? "&datos=ejemplo" : ""}`, `Paso ${n}`]),
  },
  {
    titulo: "PUB-05.3 · Ubicación (?ubicacion)",
    enlaces: ["direccion", "mapa", "gps", "denegado"].map((u): [string, string] => [`${AVISTAMIENTO}?ubicacion=${u}`, u]),
  },
  {
    titulo: "PUB-05.4 · Estado del animal (?caso)",
    enlaces: ["vacio", "combinadas", "fallecido"].map((c): [string, string] => [`${AVISTAMIENTO}?caso=${c}`, c]),
  },
  {
    titulo: "Transversales",
    enlaces: [
      ["/ruta-que-no-existe", "TRA-01 · página no encontrada"],
      ["/dev/transversales/error", "TRA-04 · error o sin conexión"],
    ],
  },
];

export default function PantallasVisitante() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Pantallas del Visitante</h1>
          <p className="text-small text-text-muted">Bloque 3 · variantes de desarrollo; no forman parte del sitio.</p>
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
