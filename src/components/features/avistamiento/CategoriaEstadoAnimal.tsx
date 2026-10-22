"use client";

import { Boton } from "@/components/ui/Boton";
import { Casilla } from "@/components/ui/Casilla";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Icono } from "@/components/ui/Icono";
import { Plegable } from "@/components/ui/Plegable";
import { cx } from "@/lib/clases";
import { alternarIntegridad, categoriaDeshabilitada, elegirUnica, opcionDeshabilitada, type SeleccionEstadoAnimal } from "@/lib/estadoAnimal";
import { ESTADOS_ANIMAL, type CategoriaEstadoAnimal as Categoria } from "@/mocks/catalogos";

type Props = {
  categoria: Categoria;
  seleccion: SeleccionEstadoAnimal;
  onCambio: (s: SeleccionEstadoAnimal) => void;
  abierta: boolean;
  onAlternar: (abierta: boolean) => void;
  error?: string;
};

/** «Obligatoria» (borde continuo) u «Opcional» (borde discontinuo): se distinguen por la palabra y por el borde. */
function Insignia({ obligatoria }: { obligatoria: boolean }) {
  return (
    <span className={cx("box-border inline-flex h-6 items-center rounded-boton border px-2 text-caption font-semibold", obligatoria ? "border-border-strong bg-surface-raised" : "border-dashed border-border-strong")}>
      {obligatoria ? "Obligatoria" : "Opcional"}
    </span>
  );
}

/** Categoría plegable del catálogo de estados del animal (lámina 1.6): casillas si se combinan, radios si es única. */
export function CategoriaEstadoAnimal({ categoria, seleccion, onCambio, abierta, onAlternar, error }: Props) {
  const opciones = ESTADOS_ANIMAL.filter((e) => e.idCategoria === categoria.id);
  const elegidos = seleccion[categoria.id];
  const deshabilitada = categoriaDeshabilitada(categoria.id, seleccion);
  const errorId = `error-cat-${categoria.id}`;
  const resumen = elegidos.length ? opciones.filter((o) => elegidos.includes(o.id)).map((o) => o.nombre).join(", ") : "sin selección";

  return (
    <div data-categoria={categoria.id}>
      <Plegable
        titulo={categoria.nombre}
        insignia={<Insignia obligatoria={categoria.obligatoria} />}
        descripcion={deshabilitada ? "Categoría deshabilitada con «Fallecido»" : categoria.ayuda}
        resumen={`Resumen: ${resumen}`}
        abierto={abierta}
        onCambio={onAlternar}
        className={cx(error && "border-danger")}
      >
        {categoria.seleccion === "multiple" ? (
          <fieldset data-invalido={error ? "true" : undefined} aria-describedby={error ? errorId : undefined} className="min-w-0">
            <legend className="sr-only">{categoria.nombre}</legend>
            <div className="flex flex-col divide-y divide-border">
              {opciones.map((o) => (
                <Casilla
                  key={o.id}
                  etiqueta={
                    <span className="flex flex-col items-start gap-1 py-1">
                      <span className="font-semibold">{o.nombre}</span>
                      {o.excluyente && <span className="rounded-boton border border-border-strong px-2 text-caption">Solo puede elegirse sola</span>}
                    </span>
                  }
                  ayuda={o.descripcion}
                  checked={elegidos.includes(o.id)}
                  disabled={opcionDeshabilitada(o.id, seleccion)}
                  onChange={() => onCambio(alternarIntegridad(seleccion, o.id))}
                  className="py-1"
                />
              ))}
            </div>
          </fieldset>
        ) : (
          <>
            <GrupoRadio
              leyenda={categoria.nombre}
              ocultarLeyenda
              name={`categoria-${categoria.id}`}
              value={elegidos[0] === undefined ? "" : String(elegidos[0])}
              onChange={(e) => onCambio(elegirUnica(seleccion, categoria.id, Number(e.target.value)))}
              opciones={opciones.map((o) => ({ valor: String(o.id), etiqueta: o.nombre, descripcion: o.descripcion, deshabilitada: deshabilitada }))}
              error={error}
            />
            {!categoria.obligatoria && (
              <div className="flex justify-end">
                <Boton variante="terciario" disabled={deshabilitada || elegidos.length === 0} onClick={() => onCambio(elegirUnica(seleccion, categoria.id, undefined))}>
                  Quitar selección
                </Boton>
              </div>
            )}
          </>
        )}
        {error && categoria.seleccion === "multiple" && (
          <p id={errorId} role="alert" className="flex items-start gap-1 pb-2 text-small text-danger">
            <Icono nombre="error" tamano={16} className="mt-0.5" />
            {error}
          </p>
        )}
      </Plegable>
    </div>
  );
}
