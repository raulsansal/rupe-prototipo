"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BotonIcono } from "@/components/ui/BotonIcono";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { ChipEstatus, type Estatus } from "@/components/ui/ChipEstatus";
import { ChipFiltro } from "@/components/ui/ChipFiltro";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { InsigniaContador } from "@/components/ui/InsigniaContador";
import { ESTADOS_CASO } from "@/mocks/tipos";
import { Grupo, PanelesTema } from "./PanelesTema";

const ESTATUS: Estatus[] = ["Activo", "Inactivo", "Visible", "Oculto", "Valor protegido"];

function Filtros() {
  const [activos, setActivos] = useState<string[]>(["Todos", "Localizado"]);
  const alternar = (n: string) => setActivos((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
  return (
    <div className="flex flex-wrap gap-x-2">
      {["Todos", "En búsqueda", "Localizado"].map((n) => (
        <ChipFiltro key={n} seleccionado={activos.includes(n)} quitable={n === "Localizado"} onClick={() => alternar(n)}>
          {n}
        </ChipFiltro>
      ))}
      <ChipFiltro disabled>Cerrado</ChipFiltro>
    </div>
  );
}

function Contenido() {
  return (
    <>
      <Grupo titulo="Chips de estado del caso">
        <div className="flex flex-wrap gap-2">
          {ESTADOS_CASO.map((e) => (
            <ChipEstado key={e} estado={e} />
          ))}
        </div>
      </Grupo>
      <Grupo titulo="Chips de estatus">
        <div className="flex flex-wrap gap-2">
          {ESTATUS.map((e) => (
            <ChipEstatus key={e} estatus={e} />
          ))}
        </div>
      </Grupo>
      <Grupo titulo="Etiquetas">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta>Administrador</Etiqueta>
          <Etiqueta tono="nuevo">Nuevo</Etiqueta>
          <Avatar nombre="Raúl" color={3} />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <Avatar key={c} nombre="Ro" color={c} />
          ))}
        </div>
      </Grupo>
      <Grupo titulo="Chips de filtro (seleccionables)">
        <Filtros />
      </Grupo>
      <Grupo titulo="Insignias contador">
        <div className="flex flex-wrap items-center gap-4">
          <BotonIcono icono="notifications" etiqueta="Avistamientos" insignia={3} contorno />
          <BotonIcono icono="notifications" etiqueta="Avistamientos" insignia={12} contorno />
          <span className="flex items-center gap-2 text-body font-semibold">
            Avistamientos <InsigniaContador valor={4} descripcion="nuevos" />
          </span>
        </div>
      </Grupo>
    </>
  );
}

export function SeccionChips() {
  return (
    <PanelesTema seccion="chips" titulo="Chips e insignias" lamina="Lámina 4.7 · en oscuro los chips de estado llevan un borde de 1 px del color de su texto">
      <Contenido />
    </PanelesTema>
  );
}
