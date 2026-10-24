import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SeccionBotones } from "./SeccionBotones";
import { SeccionChips } from "./SeccionChips";
import { SeccionFormularios } from "./SeccionFormularios";
import { SeccionGraficas } from "./SeccionGraficas";
import { SeccionNavegacion } from "./SeccionNavegacion";
import { SeccionRetroalimentacion } from "./SeccionRetroalimentacion";

export const metadata: Metadata = { title: "Componentes · RUPE (solo desarrollo)" };

export default function Componentes() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Componentes</h1>
          <p className="text-small text-text-muted">Bloque 1 · galería de desarrollo, no forma parte del sitio.</p>
        </div>
        <ThemeToggle />
      </header>
      <SeccionBotones />
      <SeccionChips />
      <SeccionFormularios />
      <SeccionNavegacion />
      <SeccionRetroalimentacion />
      <SeccionGraficas />
    </main>
  );
}
