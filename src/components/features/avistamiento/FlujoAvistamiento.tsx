"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlantillaFlujo } from "@/components/layout/PlantillaFlujo";
import type { FichaPublica } from "@/mocks/tipos";
import { DATOS_VACIOS, PASOS_AVISTAMIENTO, TITULOS_PASO, validarPaso, type DatosAvistamiento, type Errores } from "./datos";
import { PasoComentario } from "./PasoComentario";
import { PasoConfirmar } from "./PasoConfirmar";
import { PasoEstadoAnimal } from "./PasoEstadoAnimal";
import { PasoFotografia } from "./PasoFotografia";
import { PasoInicio } from "./PasoInicio";
import { PasoUbicacion, type Actualizar } from "./PasoUbicacion";
import type { EstadoInicial } from "./variantes";

type Props = {
  /** Solo lo público del caso: folio, nombre y fotografía. */
  ficha: Pick<FichaPublica, "folio" | "nombre" | "fotografiaUrl">;
  inicial: EstadoInicial;
};

const PASOS_CON_CAMPOS = [2, 3, 4];

/**
 * PUB-05: reporte de avistamiento en seis pasos. Lo capturado vive en el estado de este componente (memoria):
 * los seis pasos permanecen montados y solo se oculta el que no toca, así Regresar y Continuar no pierden nada.
 * No se guarda en almacenamiento del navegador ni se envía a ningún lado.
 */
export function FlujoAvistamiento({ ficha, inicial }: Props) {
  const [paso, setPaso] = useState(inicial.paso);
  const [datos, setDatos] = useState<DatosAvistamiento>({ ...DATOS_VACIOS, ...inicial.datos });
  const [errores, setErrores] = useState<Errores>({});
  const [intentos, setIntentos] = useState(0);
  const router = useRouter();
  const montado = useRef(false);

  // Al cambiar de paso, el foco va al título y la página vuelve arriba.
  useEffect(() => {
    if (!montado.current) return;
    window.scrollTo(0, 0);
    document.getElementById("titulo-paso")?.focus();
  }, [paso]);

  // Tras un intento fallido, el foco va al primer campo con error del paso visible.
  useEffect(() => {
    if (!intentos) return;
    const panel = document.querySelector('[data-paso]:not([hidden])');
    const invalido = panel?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalido="true"]');
    const objetivo = invalido instanceof HTMLFieldSetElement ? invalido.querySelector<HTMLElement>("input:not(:disabled)") : invalido;
    objetivo?.focus();
  }, [intentos]);

  useEffect(() => {
    montado.current = true;
  }, []);

  const actualizar: Actualizar = (cambios, limpiar = []) => {
    setDatos((d) => ({ ...d, ...cambios }));
    if (limpiar.length) {
      setErrores((e) => {
        const siguiente = { ...e };
        for (const k of limpiar) delete siguiente[k];
        return siguiente;
      });
    }
  };

  function fallar(n: number, e: Errores) {
    setPaso(n);
    setErrores(e);
    setIntentos((i) => i + 1);
  }

  function continuar() {
    const e = validarPaso(paso, datos);
    if (Object.keys(e).length) return fallar(paso, e);
    setErrores({});
    if (paso < 6) return setPaso(paso + 1);
    // Enviar: se revisan de nuevo los pasos con campos, por si algo cambió.
    for (const n of PASOS_CON_CAMPOS) {
      const faltan = validarPaso(n, datos);
      if (Object.keys(faltan).length) return fallar(n, faltan);
    }
    // Maqueta: no se envía nada; solo se muestra la pantalla «Reporte enviado» (PUB-06).
    router.push(`/ficha/${ficha.folio}/avistamiento/enviado`);
  }

  function regresar() {
    setErrores({});
    setPaso(paso - 1);
  }

  const contenidos = [
    <PasoInicio key={1} ficha={ficha} />,
    <PasoFotografia key={2} vistaPreviaInicial={inicial.datos.fotoUrl} error={errores.foto} onCambio={(fotoUrl) => actualizar({ fotoUrl }, ["foto"])} />,
    <PasoUbicacion key={3} datos={datos} errores={errores} actualizar={actualizar} fijarErrores={(e) => fallar(3, e)} />,
    <PasoEstadoAnimal key={4} datos={datos} errores={errores} actualizar={actualizar} abrirTodas={inicial.abrirTodasCategorias} />,
    <PasoComentario key={5} valor={datos.comentario} onCambio={(comentario) => actualizar({ comentario })} />,
    <PasoConfirmar key={6} ficha={ficha} datos={datos} />,
  ];

  return (
    <PlantillaFlujo
      pasos={PASOS_AVISTAMIENTO}
      pasoActual={paso}
      titulo={TITULOS_PASO[paso - 1]}
      hrefSalir={`/ficha/${ficha.folio}`}
      regresar={paso > 1 ? { onClick: regresar } : undefined}
      continuar={{ etiqueta: paso === 6 ? "Enviar reporte" : "Continuar", onClick: continuar }}
    >
      {contenidos.map((contenido, i) => (
        <div key={i} data-paso={i + 1} hidden={paso !== i + 1}>
          {contenido}
        </div>
      ))}
    </PlantillaFlujo>
  );
}
