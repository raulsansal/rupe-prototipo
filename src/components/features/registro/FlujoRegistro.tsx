"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PlantillaFlujo } from "@/components/layout/PlantillaFlujo";
import { FOLIO_NUEVO } from "@/mocks/casos";
import { hoyLocal } from "../avistamiento/datos";
import { AvisoPublicoReservado } from "./AvisoPublicoReservado";
import { DialogoConfirmacion } from "@/components/ui/DialogoConfirmacion";
import { PASOS_REGISTRO, REGISTRO_VACIO, TITULOS_REGISTRO, validarRegistro, type DatosRegistro, type ErroresRegistro } from "./datos";
import { PasoCircunstancias } from "./PasoCircunstancias";
import { PasoDatosPerro, type ActualizarRegistro } from "./PasoDatosPerro";

export type EstadoInicialRegistro = { paso: 1 | 2; datos: Partial<DatosRegistro> };

/**
 * TUT-02 y TUT-03: registro de un extravío en dos pasos. Lo capturado vive en memoria; los dos pasos permanecen
 * montados y solo se oculta el que no toca, así Regresar no pierde nada. No se guarda ni se envía a ningún lado.
 */
export function FlujoRegistro({ inicial }: { inicial: EstadoInicialRegistro }) {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(inicial.paso);
  const [datos, setDatos] = useState<DatosRegistro>({ ...REGISTRO_VACIO, ...inicial.datos });
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [intentos, setIntentos] = useState(0);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const montado = useRef(false);

  useEffect(() => {
    if (!montado.current) return;
    window.scrollTo(0, 0);
    document.getElementById("titulo-paso")?.focus();
  }, [paso]);

  useEffect(() => {
    if (!intentos) return;
    const panel = document.querySelector("[data-paso]:not([hidden])");
    const invalido = panel?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalido="true"]');
    const objetivo = invalido instanceof HTMLFieldSetElement ? invalido.querySelector<HTMLElement>("input:not(:disabled)") : invalido;
    objetivo?.focus();
  }, [intentos]);

  useEffect(() => {
    montado.current = true;
  }, []);

  const actualizar: ActualizarRegistro = (cambios, limpiar = []) => {
    setDatos((d) => ({ ...d, ...cambios }));
    if (limpiar.length) {
      setErrores((e) => {
        const siguiente = { ...e };
        for (const k of limpiar) delete siguiente[k];
        return siguiente;
      });
    }
  };

  // Hay algo capturado si algún campo difiere del formulario vacío (la unidad de edad ya trae «años» por defecto).
  const hayCapturado = (Object.keys(REGISTRO_VACIO) as (keyof DatosRegistro)[]).some((k) => datos[k] !== REGISTRO_VACIO[k]);

  /** Salir del registro (flecha del encabezado o «Cancelar»): con datos capturados pide confirmación. */
  function alSalir(e: MouseEvent<HTMLElement>) {
    if (!hayCapturado) return; // vacío: el enlace navega sin preguntar
    e.preventDefault();
    setConfirmarSalida(true);
  }

  function continuar() {
    const e = validarRegistro(paso, datos, hoyLocal());
    if (Object.keys(e).length) {
      setErrores(e);
      return setIntentos((i) => i + 1);
    }
    setErrores({});
    if (paso === 1) return setPaso(2);
    // Maqueta: no se guarda nada; se muestra la pantalla «Registro creado» (TUT-04) con un folio de ejemplo.
    router.push(`/tutor/casos/${FOLIO_NUEVO}/creado`);
  }

  return (
    <PlantillaFlujo
      pasos={PASOS_REGISTRO}
      pasoActual={paso}
      titulo={TITULOS_REGISTRO[paso - 1]}
      hrefSalir="/tutor"
      onSalir={alSalir}
      regresar={paso === 1 ? { href: "/tutor", etiqueta: "Cancelar", onClick: alSalir } : { onClick: () => { setErrores({}); setPaso(1); } }}
      continuar={{ etiqueta: paso === 1 ? "Guardar y continuar" : "Guardar registro", onClick: continuar }}
    >
      <div className="flex flex-col gap-4">
        <div data-paso={1} hidden={paso !== 1} className="flex flex-col gap-4">
          <AvisoPublicoReservado />
          <PasoDatosPerro datos={datos} errores={errores} actualizar={actualizar} fotoInicial={inicial.datos.fotoUrl} />
        </div>
        <div data-paso={2} hidden={paso !== 2}>
          <PasoCircunstancias datos={datos} errores={errores} actualizar={actualizar} />
        </div>
      </div>
      <DialogoConfirmacion
        abierto={confirmarSalida}
        onCerrar={() => setConfirmarSalida(false)}
        titulo="¿Salir del registro?"
        descripcion="Se perderá lo capturado."
        textoConfirmar="Salir"
        textoCancelar="Seguir aquí"
        onConfirmar={() => router.push("/tutor")}
      />
    </PlantillaFlujo>
  );
}
