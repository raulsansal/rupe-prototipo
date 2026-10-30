"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlantillaFlujo } from "@/components/layout/PlantillaFlujo";
import { Alerta } from "@/components/ui/Alerta";
import { bajoResguardo, MENSAJE_OPCION_NO_DISPONIBLE } from "@/lib/estadoAnimal";
import type { FichaPublica } from "@/mocks/tipos";
import { DATOS_VACIOS, ERROR_DEL_CAMPO, PASO_DEL_CAMPO, PASOS_AVISTAMIENTO, TITULOS_PASO, validarPaso, type DatosAvistamiento, type Errores, type OpcionEstadoAnimal } from "./datos";
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
  /** Canal por el que se llegó: el folio o el token del QR (el que ya viene en la URL de la persona). */
  acceso: { canal: "folio" | "qr"; clave: string };
  /** Alcaldías del catálogo, sin «Fuera de la Ciudad de México». */
  alcaldias: { id: number; nombre: string }[];
  /** Opciones ACTIVAS del catálogo de estados del animal. */
  estadosAnimal: OpcionEstadoAnimal[];
  maximoMb: number;
  inicial: EstadoInicial;
};

const PASOS_CON_CAMPOS = [2, 3, 4, 5];

/**
 * PUB-05: reporte de avistamiento en seis pasos. Lo capturado vive en el estado de este componente (memoria):
 * los seis pasos permanecen montados y solo se oculta el que no toca, así Regresar y Continuar no pierden nada.
 * No se guarda en almacenamiento del navegador. Al confirmar se envía UNA petición POST /api/avistamientos (la foto ya reducida); el servidor vuelve a validar el acceso y todos los campos.
 */
export function FlujoAvistamiento({ ficha, acceso, alcaldias, estadosAnimal, maximoMb, inicial }: Props) {
  const [paso, setPaso] = useState(inicial.paso);
  const [datos, setDatos] = useState<DatosAvistamiento>({ ...DATOS_VACIOS, ...inicial.datos });
  const [errores, setErrores] = useState<Errores>({});
  const [intentos, setIntentos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string>();
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

  async function enviar() {
    setErrorEnvio(undefined);
    setEnviando(true);
    try {
      const f = new FormData();
      f.set("datos", JSON.stringify({
        acceso: acceso.canal === "folio" ? { canal: "folio", folio: acceso.clave } : { canal: "qr", token: acceso.clave },
        fecha: datos.fecha, hora: datos.hora, direccion: datos.direccion, idAlcaldia: Number(datos.alcaldiaElegida), coloniaZona: datos.colonia, referencias: datos.referencias,
        estadosAnimal: Object.values(datos.estados).flat(), comentario: datos.comentario,
      }));
      if (datos.foto) f.set("fotografia", datos.foto, "fotografia.jpg");
      const r = await fetch("/api/avistamientos", { method: "POST", body: f });
      const j = (await r.json().catch(() => ({}))) as { id?: number; folio?: string; error?: { campos?: Record<string, string>; mensaje?: string } };
      if (r.status === 201 && j.id !== undefined && j.folio) return router.push(`/ficha/${j.folio}/avistamiento/enviado?id=${j.id}`); // solo el ID: la pantalla final no consulta ningún dato
      if (r.status === 404 || r.status === 409) return router.refresh(); // el caso o el QR dejaron de valer: la pantalla vuelve a validar el acceso y muestra su mensaje
      if (r.status === 422 && j.error?.campos) {
        const e: Errores = {};
        let primero = 6;
        for (const [campo, mensaje] of Object.entries(j.error.campos)) {
          const clave = ERROR_DEL_CAMPO[campo];
          if (campo === "estadosAnimal" && mensaje === MENSAJE_OPCION_NO_DISPONIBLE) {
            // Una opción dejó de estar disponible: se muestra en la categoría que la contiene (o, si no se sabe cuál, al inicio del paso) y se quita de la selección.
            const activos = new Set(estadosAnimal.map((x) => x.id));
            const categoria = Object.entries(datos.estados).find(([, ids]) => ids.some((id) => !activos.has(id)))?.[0];
            if (categoria) e[`cat${categoria}` as "cat1"] = mensaje;
            else e.estados = mensaje;
            setDatos((d) => ({ ...d, estados: Object.fromEntries(Object.entries(d.estados).map(([c, ids]) => [c, ids.filter((id) => activos.has(id))])) as DatosAvistamiento["estados"] }));
          } else if (clave) e[clave] = mensaje;
          primero = Math.min(primero, PASO_DEL_CAMPO[campo] ?? 6);
        }
        return fallar(primero, e);
      }
      if (r.status === 413) return fallar(2, { foto: "La fotografía es demasiado grande. Elige otra o una de menor tamaño." });
      setErrorEnvio(j.error?.mensaje ?? "No se pudo enviar el reporte. Inténtalo de nuevo.");
    } catch {
      setErrorEnvio("No se pudo enviar el reporte. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
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
    void enviar();
  }

  function regresar() {
    setErrores({});
    setPaso(paso - 1);
  }

  const contenidos = [
    <PasoInicio key={1} ficha={ficha} />,
    <PasoFotografia key={2} maximoMb={maximoMb} vistaPreviaInicial={inicial.datos.fotoUrl} error={errores.foto} onCambio={(fotoUrl, foto) => actualizar({ fotoUrl, foto }, ["foto"])} />,
    <PasoUbicacion key={3} datos={datos} errores={errores} actualizar={actualizar} alcaldias={alcaldias} />,
    <PasoEstadoAnimal key={4} datos={datos} errores={errores} actualizar={actualizar} estadosAnimal={estadosAnimal} abrirTodas={inicial.abrirTodasCategorias} />,
    <PasoComentario key={5} valor={datos.comentario} bajoResguardo={bajoResguardo(datos.estados)} error={errores.comentario} onCambio={(comentario) => actualizar({ comentario }, ["comentario"])} />,
    <PasoConfirmar key={6} ficha={ficha} datos={datos} alcaldias={alcaldias} estadosAnimal={estadosAnimal} />,
  ];

  return (
    <PlantillaFlujo
      pasos={PASOS_AVISTAMIENTO}
      pasoActual={paso}
      titulo={TITULOS_PASO[paso - 1]}
      hrefSalir={`/ficha/${ficha.folio}`}
      regresar={paso > 1 ? { onClick: regresar } : undefined}
      continuar={{ etiqueta: paso === 6 ? "Enviar reporte" : "Continuar", onClick: continuar, cargando: enviando }}
    >
      {errorEnvio && (
        <div className="mb-4">
          <Alerta tipo="peligro" titulo="No se envió el reporte">
            {errorEnvio}
          </Alerta>
        </div>
      )}
      {contenidos.map((contenido, i) => (
        <div key={i} data-paso={i + 1} hidden={paso !== i + 1}>
          {contenido}
        </div>
      ))}
    </PlantillaFlujo>
  );
}
