"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PlantillaFlujo } from "@/components/layout/PlantillaFlujo";
import { hoyLocal } from "../avistamiento/datos";
import { AvisoPublicoReservado } from "./AvisoPublicoReservado";
import { Alerta } from "@/components/ui/Alerta";
import { DialogoConfirmacion } from "@/components/ui/DialogoConfirmacion";
import { ModalSesionExpirada } from "../ModalSesionExpirada";
import { PASOS_REGISTRO, REGISTRO_VACIO, TITULOS_REGISTRO, validarRegistro, type DatosRegistro, type ErroresRegistro } from "./datos";
import { PasoCircunstancias } from "./PasoCircunstancias";
import { PasoDatosPerro, type ActualizarRegistro } from "./PasoDatosPerro";

export type EstadoInicialRegistro = { paso: 1 | 2; datos: Partial<DatosRegistro> };

/**
 * TUT-02 y TUT-03 (HU 011, 012 y 013): registro de un extravío en dos pasos. Lo capturado vive solo en el estado de React (sin almacenamiento del navegador);
 * los dos pasos permanecen montados y solo se oculta el que no toca, así Regresar no pierde nada. «Guardar registro» envía UNA sola petición a POST /api/casos
 * (datos + fotografía ya reducida) y lleva a la confirmación con el folio real. Los errores por campo del servidor vuelven a su paso.
 */
export function FlujoRegistro({ inicial }: { inicial: EstadoInicialRegistro }) {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(inicial.paso);
  const [datos, setDatos] = useState<DatosRegistro>({ ...REGISTRO_VACIO, ...inicial.datos });
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [intentos, setIntentos] = useState(0);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string>();
  const [sesionExpirada, setSesionExpirada] = useState(false);
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

  /** Campos del servidor que pertenecen al paso 1; el resto son del paso 2. */
  const CAMPOS_PASO_1 = ["nombre", "sexo", "raza", "razaEspecificada", "edad", "tamano", "color", "caracteristicas", "foto"];

  async function guardar() {
    setEnviando(true);
    setErrorEnvio(undefined);
    try {
      const formulario = new FormData();
      formulario.set(
        "datos",
        JSON.stringify({
          nombre: datos.nombre, sexo: datos.sexo, idRaza: Number(datos.razaId), razaEspecificada: datos.razaEspecificada, edad: { valor: Number(datos.edadValor), unidad: datos.edadUnidad }, tamano: datos.tamano,
          color: datos.color, caracteristicas: datos.caracteristicas, fechaExtravio: datos.fechaExtravio, momento: datos.momento, alcaldia: datos.alcaldia, colonia: datos.colonia, calle: datos.calle,
          referencias: datos.referencias, idMotivo: Number(datos.motivoId), descripcion: datos.descripcion,
        }),
      );
      if (datos.foto) formulario.set("fotografia", datos.foto, "fotografia.jpg");
      const r = await fetch("/api/casos", { method: "POST", body: formulario });
      const cuerpo = (await r.json().catch(() => ({}))) as { destino?: string; error?: { codigo: string; mensaje: string; campos?: Record<string, string> } };
      if (r.status === 201 && cuerpo.destino) return router.push(cuerpo.destino);
      if (r.status === 401) return setSesionExpirada(true);
      const campos = cuerpo.error?.campos;
      if (r.status === 422 && campos && Object.keys(campos).length) {
        setErrores(campos as ErroresRegistro);
        setPaso(Object.keys(campos).some((k) => CAMPOS_PASO_1.includes(k)) ? 1 : 2);
        return setIntentos((i) => i + 1);
      }
      if (r.status === 413) {
        setPaso(1);
        return setErrorEnvio("La fotografía es demasiado grande. Elige otra foto o una más pequeña.");
      }
      setErrorEnvio(cuerpo.error?.mensaje ?? "No pudimos guardar el registro. Inténtalo de nuevo.");
    } catch {
      setErrorEnvio("No pudimos guardar el registro. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function continuar() {
    const e = validarRegistro(paso, datos, hoyLocal());
    if (Object.keys(e).length) {
      setErrores(e);
      return setIntentos((i) => i + 1);
    }
    setErrores({});
    if (paso === 1) return setPaso(2);
    void guardar();
  }

  return (
    <PlantillaFlujo
      pasos={PASOS_REGISTRO}
      pasoActual={paso}
      titulo={TITULOS_REGISTRO[paso - 1]}
      hrefSalir="/tutor"
      onSalir={alSalir}
      regresar={paso === 1 ? { href: "/tutor", etiqueta: "Cancelar", onClick: alSalir } : { onClick: () => { setErrores({}); setPaso(1); } }}
      continuar={{ etiqueta: paso === 1 ? "Guardar y continuar" : "Guardar registro", onClick: continuar, cargando: enviando }}
    >
      <div className="flex flex-col gap-4">
        {errorEnvio && (
          <Alerta tipo="peligro" titulo="No pudimos guardar el registro">
            {errorEnvio}
          </Alerta>
        )}
        <div data-paso={1} hidden={paso !== 1} className="flex flex-col gap-4">
          <AvisoPublicoReservado />
          <PasoDatosPerro datos={datos} errores={errores} actualizar={actualizar} fotoInicial={inicial.datos.fotoUrl} />
        </div>
        <div data-paso={2} hidden={paso !== 2}>
          <PasoCircunstancias datos={datos} errores={errores} actualizar={actualizar} />
        </div>
      </div>
      <ModalSesionExpirada abierto={sesionExpirada} onCerrar={() => setSesionExpirada(false)} onIniciarSesion={() => router.push("/acceso?siguiente=%2Ftutor%2Fregistrar")} />
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
