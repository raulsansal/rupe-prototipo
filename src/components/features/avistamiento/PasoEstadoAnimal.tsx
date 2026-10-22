"use client";

import { useState, useSyncExternalStore } from "react";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { CATEGORIAS_ESTADO_ANIMAL } from "@/mocks/catalogos";
import { CategoriaEstadoAnimal } from "./CategoriaEstadoAnimal";
import { hoyLocal, type DatosAvistamiento, type Errores } from "./datos";
import type { Actualizar } from "./PasoUbicacion";

type Props = {
  datos: DatosAvistamiento;
  errores: Errores;
  actualizar: Actualizar;
  /** Categorías abiertas al cargar: las obligatorias; las capturas de variantes abren todas. */
  abrirTodas?: boolean;
};

/** Paso 4 (PUB-05.4 / lámina 1.6): fecha, hora y estado del animal con las reglas de selección del catálogo (R3). */
export function PasoEstadoAnimal({ datos, errores, actualizar, abrirTodas }: Props) {
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>(() => Object.fromEntries(CATEGORIAS_ESTADO_ANIMAL.map((c) => [c.id, abrirTodas || c.obligatoria])));
  // «Hoy» solo se conoce en el navegador de la persona: en el servidor es undefined, para no desajustar la hidratación.
  const hoy = useSyncExternalStore(
    () => () => {},
    () => hoyLocal(),
    () => undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto etiqueta="Fecha" type="date" required max={hoy} value={datos.fecha} onChange={(e) => actualizar({ fecha: e.target.value }, ["fecha", "hora"])} error={errores.fecha} />
        <CampoTexto etiqueta="Hora" type="time" required value={datos.hora} onChange={(e) => actualizar({ hora: e.target.value }, ["hora"])} error={errores.hora} />
      </div>
      {CATEGORIAS_ESTADO_ANIMAL.map((c) => (
        <CategoriaEstadoAnimal
          key={c.id}
          categoria={c}
          seleccion={datos.estados}
          onCambio={(estados) => actualizar({ estados }, c.id === 1 ? ["cat1"] : c.id === 2 ? ["cat2"] : [])}
          abierta={abiertas[c.id] || Boolean(c.id === 1 ? errores.cat1 : c.id === 2 ? errores.cat2 : false)} /* con error, la categoría se muestra abierta */
          onAlternar={(abierta) => setAbiertas((a) => ({ ...a, [c.id]: abierta }))}
          error={c.id === 1 ? errores.cat1 : c.id === 2 ? errores.cat2 : undefined}
        />
      ))}
    </div>
  );
}
