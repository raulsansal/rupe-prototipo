"use client";

import { AreaTexto } from "@/components/ui/AreaTexto";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { CargaFotografia } from "@/components/ui/CargaFotografia";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Selector } from "@/components/ui/Selector";
import { RAZAS } from "@/mocks/catalogos";
import type { Sexo, Tamano } from "@/mocks/tipos";
import { esRazaOtra, MAXIMOS, opcionesEdad, type DatosRegistro, type ErroresRegistro } from "./datos";

export type ActualizarRegistro = (cambios: Partial<DatosRegistro>, limpiar?: (keyof ErroresRegistro)[]) => void;

type Props = { datos: DatosRegistro; errores: ErroresRegistro; actualizar: ActualizarRegistro; fotoInicial?: string };

const SEXOS: Sexo[] = ["Macho", "Hembra", "No sé"];
const TAMANOS: { valor: Tamano; etiqueta: string }[] = [
  { valor: "pequeño", etiqueta: "Pequeño" },
  { valor: "mediano", etiqueta: "Mediano" },
  { valor: "grande", etiqueta: "Grande" },
];

/** TUT-02: datos del perro y fotografía (HU 011). Todo es obligatorio salvo las características y la raza especificada. */
export function PasoDatosPerro({ datos, errores, actualizar, fotoInicial }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <CampoTexto
        etiqueta="Nombre del perro"
        required
        maxLength={MAXIMOS.nombre}
        autoComplete="off"
        value={datos.nombre}
        onChange={(e) => actualizar({ nombre: e.target.value }, ["nombre"])}
        error={errores.nombre}
      />
      <GrupoRadio
        leyenda="Sexo"
        name="sexo"
        variante="tarjetas"
        requerido
        value={datos.sexo}
        onChange={(e) => actualizar({ sexo: e.target.value as Sexo }, ["sexo"])}
        opciones={SEXOS.map((s) => ({ valor: s, etiqueta: s }))}
        error={errores.sexo}
      />
      <Selector
        etiqueta="Raza"
        required
        marcador="Elige una raza"
        opciones={RAZAS.map((r) => ({ valor: String(r.id), etiqueta: r.nombre }))}
        value={datos.razaId}
        onChange={(e) => actualizar({ razaId: e.target.value, razaEspecificada: "" }, ["raza", "razaEspecificada"])}
        error={errores.raza}
      />
      {esRazaOtra(datos) && (
        <CampoTexto
          etiqueta="Especifique la raza"
          required
          maxLength={MAXIMOS.razaEspecificada}
          autoComplete="off"
          value={datos.razaEspecificada}
          onChange={(e) => actualizar({ razaEspecificada: e.target.value }, ["razaEspecificada"])}
          error={errores.razaEspecificada}
        />
      )}
      <fieldset className="min-w-0" aria-describedby="ayuda-edad">
        <legend className="mb-1 text-small font-semibold">
          Edad aproximada
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <Selector
            etiqueta="Valor"
            required
            marcador="Valor"
            opciones={opcionesEdad(datos.edadUnidad)}
            value={datos.edadValor}
            onChange={(e) => actualizar({ edadValor: e.target.value }, ["edad"])}
            error={errores.edad}
          />
          <Selector
            etiqueta="Unidad"
            opciones={[
              { valor: "meses", etiqueta: "Meses" },
              { valor: "años", etiqueta: "Años" },
            ]}
            value={datos.edadUnidad}
            onChange={(e) => actualizar({ edadUnidad: e.target.value as DatosRegistro["edadUnidad"], edadValor: "" })}
          />
        </div>
        <p id="ayuda-edad" className="mt-1 text-small text-text-muted">
          Meses: de 0 a 11 (0 = menos de 1 mes). Años: de 1 a 50.
        </p>
      </fieldset>
      <GrupoRadio
        leyenda="Tamaño"
        name="tamano"
        variante="tarjetas"
        requerido
        value={datos.tamano}
        onChange={(e) => actualizar({ tamano: e.target.value as Tamano }, ["tamano"])}
        opciones={TAMANOS}
        error={errores.tamano}
      />
      <CampoTexto
        etiqueta="Color"
        required
        maxLength={MAXIMOS.color}
        autoComplete="off"
        value={datos.color}
        onChange={(e) => actualizar({ color: e.target.value }, ["color"])}
        error={errores.color}
      />
      <AreaTexto
        etiqueta="Características distintivas (opcional)"
        maxLength={MAXIMOS.caracteristicas}
        rows={4}
        value={datos.caracteristicas}
        onChange={(e) => actualizar({ caracteristicas: e.target.value })}
      />
      <CargaFotografia
        etiqueta="Fotografía del perro"
        requerido
        variante="ancha"
        vistaPreviaInicial={fotoInicial}
        onCambio={(fotoUrl) => actualizar({ fotoUrl }, ["foto"])}
        errorExterno={errores.foto}
      />
    </div>
  );
}
