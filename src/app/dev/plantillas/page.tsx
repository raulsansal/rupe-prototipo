import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = { title: "Plantillas · RUPE (solo desarrollo)" };

const DEMOS = [
  { href: "/dev/plantillas/publica", titulo: "PlantillaPublica (PLT-PUB)", detalle: "Visitante. Menú móvil: ?menu=abierto." },
  { href: "/dev/plantillas/tutor", titulo: "PlantillaTutor (PLT-TUT)", detalle: "Persona tutora: barra inferior en móvil, navegación en el encabezado desde 768 px." },
  { href: "/dev/plantillas/admin", titulo: "PlantillaAdmin (PLT-ADM)", detalle: "Administrador: cajón lateral en móvil (?menu=abierto), barra lateral desde 1024 px." },
  { href: "/dev/plantillas/flujo", titulo: "PlantillaFlujo", detalle: "Flujo por pasos compartido por el reporte de avistamiento y el registro de la persona tutora." },
  { href: "/", titulo: "Rutas reales con su plantilla", detalle: "/ (pública), /tutor y /admin aplican su plantilla mediante layout." },
];

export default function Plantillas() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Plantillas</h1>
          <p className="text-small text-text-muted">Bloque 2 · demostraciones de desarrollo, no forman parte del sitio.</p>
        </div>
        <ThemeToggle />
      </header>
      <ul className="mt-6 flex flex-col gap-3">
        {DEMOS.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="block rounded-tarjeta border border-border bg-surface p-4 hover:border-border-strong">
              <span className="text-h3 font-semibold text-primary">{d.titulo}</span>
              <span className="mt-1 block text-small text-text-muted">{d.detalle}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/tutor" className="inline-flex h-tactil items-center text-small font-semibold text-primary underline">
            /tutor
          </Link>{" "}
          <Link href="/admin" className="ml-4 inline-flex h-tactil items-center text-small font-semibold text-primary underline">
            /admin
          </Link>
        </li>
      </ul>
    </main>
  );
}
