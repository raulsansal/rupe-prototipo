"use client";

import { Alerta } from "@/components/ui/Alerta";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Selector } from "@/components/ui/Selector";
import { LIMITES_TEXTO, NOTA_UBICACION_SIMULADA, type DatosAvistamiento, type Errores } from "./datos";

export type Actualizar = (cambios: Partial<DatosAvistamiento>, limpiar?: (keyof Errores)[]) => void;

type Props = {
  datos: DatosAvistamiento;
  errores: Errores;
  actualizar: Actualizar;
  /** Alcaldías del catálogo, sin «Fuera de la Ciudad de México». */
  alcaldias: { id: number; nombre: string }[];
};

/**
 * Paso 3 (PUB-05.3, HU 030): dirección aproximada, alcaldía, colonia y referencias. «Marcar en mapa» (HU 031) y «Usar mi ubicación» (HU 032) aparecen deshabilitados con «Próximamente»: el
 * Prototipo calcula una ubicación aproximada SIMULADA a partir de la alcaldía y la dirección.
 */
export function PasoUbicacion({ datos, errores, actualizar, alcaldias }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Boton variante="secundario" icono="map" disabled aria-describedby="proximamente-mapa" anchoCompleto>
            Marcar en mapa
          </Boton>
          <p id="proximamente-mapa" className="text-caption text-text-muted">
            Próximamente
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Boton variante="secundario" icono="location_on" disabled aria-describedby="proximamente-gps" anchoCompleto>
            Usar mi ubicación
          </Boton>
          <p id="proximamente-gps" className="text-caption text-text-muted">
            Próximamente
          </p>
        </div>
      </div>
      <CampoTexto
        etiqueta="Dirección aproximada"
        required
        maxLength={LIMITES_TEXTO.direccion}
        autoComplete="off"
        ayuda="Calle y número aproximado, o cruce."
        value={datos.direccion}
        onChange={(e) => actualizar({ direccion: e.target.value }, ["direccion"])}
        error={errores.direccion}
      />
      <Selector
        etiqueta="Alcaldía"
        required
        marcador="Elige una alcaldía"
        opciones={alcaldias.map((a) => ({ valor: String(a.id), etiqueta: a.nombre }))}
        value={datos.alcaldiaElegida}
        onChange={(e) => actualizar({ alcaldiaElegida: e.target.value }, ["alcaldia"])}
        error={errores.alcaldia}
      />
      <CampoTexto
        etiqueta="Colonia o zona (opcional)"
        maxLength={LIMITES_TEXTO.colonia}
        autoComplete="off"
        value={datos.colonia}
        onChange={(e) => actualizar({ colonia: e.target.value }, ["colonia"])}
        error={errores.colonia}
      />
      <AreaTexto
        etiqueta="Referencias del lugar (opcional)"
        ayuda="Por ejemplo, junto a qué negocio o entre qué calles."
        maxLength={LIMITES_TEXTO.referencias}
        rows={3}
        value={datos.referencias}
        onChange={(e) => actualizar({ referencias: e.target.value }, ["referencias"])}
        error={errores.referencias}
      />
      <Alerta tipo="info" titulo={NOTA_UBICACION_SIMULADA}>
        Con la dirección y la alcaldía se calcula un punto aproximado; en esta fase no se usa un mapa real.
      </Alerta>
    </div>
  );
}
