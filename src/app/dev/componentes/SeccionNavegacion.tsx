"use client";

import { BarraNavegacionEscritorio } from "@/components/ui/BarraNavegacionEscritorio";
import { BarraNavegacionInferior } from "@/components/ui/BarraNavegacionInferior";
import { BarraSuperiorMovil } from "@/components/ui/BarraSuperiorMovil";
import { Pestanas } from "@/components/ui/Pestanas";
import { TarjetaAvistamiento } from "@/components/features/TarjetaAvistamiento";
import { TarjetaPerro } from "@/components/features/TarjetaPerro";
import { AVISTAMIENTO_EJEMPLO, FICHAS_EJEMPLO } from "@/mocks/registros";
import { Grupo, PanelesTema } from "./PanelesTema";

const ITEMS = [
  { href: "#inicio", etiqueta: "Inicio", icono: "home" },
  { href: "#registrar", etiqueta: "Registrar", icono: "add_circle" },
  { href: "#consultar", etiqueta: "Consultar folio", icono: "search" },
  { href: "#cuenta", etiqueta: "Cuenta", icono: "person" },
] as const;

function Contenido() {
  return (
    <>
      <Grupo titulo="Barra superior y de navegación · móvil">
        <div className="flex max-w-sm flex-col gap-3">
          <BarraSuperiorMovil />
          <BarraNavegacionInferior items={[...ITEMS]} activo="#consultar" />
        </div>
      </Grupo>
      <Grupo titulo="Escritorio (en el sitio se ve a partir de 768 px; aquí se desplaza horizontalmente si no cabe)">
        <div className="overflow-x-auto">
          <BarraNavegacionEscritorio forzarVisible className="min-w-[34rem]" items={ITEMS.slice(0, 3)} activo="#inicio" accion={{ href: "#entrar", etiqueta: "Entrar" }} />
        </div>
      </Grupo>
      <Grupo titulo="Pestañas con contador">
        <Pestanas
          etiqueta="Mis registros"
          pestanas={[
            { id: "activos", etiqueta: "Activos", contador: 3 },
            { id: "localizados", etiqueta: "Localizados", contador: 1 },
            { id: "todos", etiqueta: "Todos", contador: 4 },
          ]}
        >
          {(id) => <p className="text-small text-text-muted">Contenido de la pestaña «{id}».</p>}
        </Pestanas>
      </Grupo>
      <Grupo titulo="Tarjeta de perro (Mis registros) · normal, presionada, caso cerrado">
        <div className="flex flex-col gap-3">
          <TarjetaPerro ficha={FICHAS_EJEMPLO[0]} href="#max" />
          <TarjetaPerro ficha={FICHAS_EJEMPLO[1]} href="#luna" data-estado="presionado" />
          <TarjetaPerro ficha={FICHAS_EJEMPLO[2]} href="#toby" />
        </div>
      </Grupo>
      <Grupo titulo="Tarjeta de avistamiento">
        <TarjetaAvistamiento avistamiento={AVISTAMIENTO_EJEMPLO} />
      </Grupo>
    </>
  );
}

export function SeccionNavegacion() {
  return (
    <PanelesTema seccion="navegacion" titulo="Navegación y tarjetas" lamina="Lámina 4.9">
      <Contenido />
    </PanelesTema>
  );
}
