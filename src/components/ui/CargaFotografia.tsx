"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { cx } from "@/lib/clases";
import { reducirImagen } from "@/components/features/registro/ReduccionDeImagen";
import { PARAMETROS } from "@/mocks/parametros";
import { Boton } from "./Boton";
import { Icono } from "./Icono";

/** Tamaño máximo del parámetro `tamano_maximo_archivo_mb` del diccionario (R11). */
const MAX_MB = PARAMETROS.tamano_maximo_archivo_mb;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png"];
/** Con reducción en el navegador se aceptan originales grandes (la foto de un teléfono); más que esto ni se intenta decodificar. */
const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;

type ErrorFoto = { titulo: string; detalle: string };

type Props = {
  etiqueta: string;
  name?: string;
  requerido?: boolean;
  /** Estado inicial (la galería lo usa para mostrar «con foto» y «error»). */
  vistaPreviaInicial?: string;
  errorInicial?: ErrorFoto;
  /** Se llama al elegir o quitar la foto, con la dirección de su vista previa (o nada si se quitó o no es válida). */
  onCambio?: (vista: string | undefined, archivo?: Blob) => void;
  /** Reduce la imagen en el navegador (lado máximo, JPEG, sin metadatos) antes de entregarla: `onCambio` recibe también el archivo reducido que se enviará. */
  reducir?: boolean;
  /** Error de validación del formulario (p. ej. «La fotografía es obligatoria»); se asocia al control con aria-describedby. */
  errorExterno?: string;
  /**
   * cuadrada: caja 1:1 con vista previa recortada (reporte de avistamiento).
   * ancha: caja punteada a todo el ancho con «Tomar foto» y «Elegir de galería»; con foto, vista previa SIN recorte y «Reemplazar
   * fotografía» (la foto se reemplaza, no se quita). Es la de las láminas 2.4 (TUT-02) y 1.3 (PUB-05.2).
   */
  variante?: "cuadrada" | "ancha";
  /** Texto de ayuda de la variante ancha; «{max}» se sustituye por el máximo del parámetro (MB). */
  ayuda?: string;
  className?: string;
};

/** Carga de una fotografía (JPG o PNG, con el tamaño máximo del parámetro del sistema). El recorte de la variante cuadrada es solo de presentación. */
export function CargaFotografia({ etiqueta, name, requerido, vistaPreviaInicial, errorInicial, onCambio, reducir = false, errorExterno, variante = "cuadrada", ayuda = "Solo una fotografía por caso. JPG o PNG, máx. {max} MB. Reemplazable.", className }: Props) {
  const id = useId();
  const galeria = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | undefined>(vistaPreviaInicial);
  const [error, setError] = useState<ErrorFoto | undefined>(errorInicial);

  useEffect(() => {
    return () => {
      if (vista?.startsWith("blob:")) URL.revokeObjectURL(vista);
    };
  }, [vista]);

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      setVista(undefined);
      onCambio?.(undefined);
      return setError({ titulo: "Solo se admite JPG o PNG", detalle: "Elige otra foto" });
    }
    if (reducir) {
      // La reducción baja el peso y descarta los metadatos; el límite se aplica al resultado, no al original.
      if (archivo.size > MAX_ORIGINAL_BYTES) {
        setVista(undefined);
        onCambio?.(undefined);
        return setError({ titulo: `La foto pesa más de ${MAX_ORIGINAL_BYTES / 1024 / 1024} MB`, detalle: "Elige otra o redúcela" });
      }
      const r = await reducirImagen(archivo, MAX_BYTES);
      if ("error" in r) {
        setVista(undefined);
        onCambio?.(undefined);
        return setError(r.error);
      }
      setError(undefined);
      const urlReducida = URL.createObjectURL(r.blob);
      setVista(urlReducida);
      return onCambio?.(urlReducida, r.blob);
    }
    if (archivo.size > MAX_BYTES) {
      setVista(undefined);
      onCambio?.(undefined);
      return setError({ titulo: `La foto pesa más de ${MAX_MB} MB`, detalle: "Elige otra o redúcela" });
    }
    setError(undefined);
    const url = URL.createObjectURL(archivo);
    setVista(url);
    onCambio?.(url);
  }

  function quitar(e: React.MouseEvent<HTMLButtonElement>) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = "";
    setVista(undefined);
    setError(undefined);
    onCambio?.(undefined);
    e.currentTarget.blur();
  }

  const descripcionId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const hayError = Boolean(error || errorExterno);
  const etiquetaCampo = (
    <span className="text-small font-semibold">
      {etiqueta}
      {requerido && (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      )}
    </span>
  );
  const errorVisible = errorExterno && (
    <p id={errorId} className="flex items-start gap-1 text-small text-danger">
      <Icono nombre="error" tamano={16} className="mt-0.5" />
      {errorExterno}
    </p>
  );
  // El control principal (galería) lleva el id, la validación y la descripción; con la cámara solo cambia el origen de la foto.
  const control = (
    <input
      ref={galeria}
      id={id}
      name={name}
      tabIndex={variante === "ancha" ? -1 : undefined}
      type="file"
      accept="image/jpeg,image/png"
      required={requerido && !vista}
      className="sr-only"
      onChange={alElegir}
      aria-invalid={hayError ? true : undefined}
      aria-describedby={errorExterno ? `${errorId} ${descripcionId}` : descripcionId}
    />
  );

  if (variante === "ancha") {
    // Los botones son el componente Boton (44 px); abren los selectores de archivo ocultos. Los inputs no entran al orden de tabulación.
    return (
      <div className={cx("flex flex-col gap-1", className)}>
        {etiquetaCampo}
        {vista ? (
          <div className="foco-hijo flex flex-col rounded-tarjeta">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-tarjeta border border-border bg-background">
              <Image src={vista} alt="Vista previa de la fotografía" fill unoptimized loading="eager" className="object-contain" />
            </div>
            <Boton variante="secundario" anchoCompleto className="rounded-t-none!" onClick={() => galeria.current?.click()}>
              Reemplazar fotografía
            </Boton>
            {control}
          </div>
        ) : (
          <div className={cx("foco-hijo flex flex-col items-center gap-3 rounded-tarjeta border-2 border-dashed p-4 text-center", hayError ? "border-danger bg-danger-bg" : "border-border-strong bg-surface")}>
            <Icono nombre={error ? "error" : "photo_camera"} tamano={32} className={error ? "text-danger" : "text-primary"} />
            <p className={cx("text-body font-semibold", error && "text-danger")}>{error ? error.titulo : "Agregar fotografía"}</p>
            {error && <p className="text-small text-danger">{error.detalle}</p>}
            {/* Dos columnas del mismo ancho si el texto cabe sin partirse; si no, uno bajo el otro. */}
            <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
              <Boton variante="secundario" className="whitespace-nowrap" onClick={() => camara.current?.click()}>
                Tomar foto
              </Boton>
              <Boton variante="secundario" className="whitespace-nowrap" onClick={() => galeria.current?.click()}>
                Elegir de galería
              </Boton>
            </div>
            {control}
            <input ref={camara} type="file" accept="image/jpeg,image/png" capture="environment" tabIndex={-1} className="sr-only" onChange={alElegir} aria-describedby={descripcionId} />
          </div>
        )}
        {errorVisible}
        <p id={descripcionId} className="text-small text-text-muted">
          {ayuda.replace("{max}", String(MAX_MB))}
        </p>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      {etiquetaCampo}
      <div
        className={cx(
          "foco-hijo relative aspect-square w-full max-w-56 overflow-hidden rounded-tarjeta",
          vista ? "border border-border" : cx("border-2 border-dashed", hayError ? "border-danger bg-danger-bg" : "border-border-strong bg-surface"),
        )}
      >
        {control}
        {vista ? (
          <>
            <Image src={vista} alt="Vista previa de la fotografía" fill unoptimized loading="eager" className="object-cover" />
            <button
              type="button"
              aria-label="Quitar fotografía"
              onClick={quitar}
              className="absolute right-1 top-1 inline-flex size-tactil items-center justify-center rounded-full text-text"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-surface">
                <Icono nombre="close" tamano={20} />
              </span>
            </button>
            <label htmlFor={id} className="absolute bottom-2 left-2 inline-flex h-tactil cursor-pointer items-center gap-1.5 rounded-chip bg-surface px-4 text-small font-semibold text-text">
              <Icono nombre="edit" tamano={16} />
              Cambiar
            </label>
          </>
        ) : (
          <label htmlFor={id} className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center">
            <Icono nombre={error ? "error" : "add_a_photo"} tamano={32} className={error ? "text-danger" : "text-primary"} />
            <span className={cx("text-small font-semibold", error && "text-danger")}>{error ? error.titulo : "Toca para tomar o elegir una foto"}</span>
            <span className={cx("text-caption", error ? "text-danger" : "text-text-muted")}>{error ? error.detalle : `JPG o PNG · máx. ${MAX_MB} MB`}</span>
          </label>
        )}
      </div>
      {errorVisible}
      <p id={descripcionId} className="text-small text-text-muted">
        Una sola fotografía; se muestra recortada en 1:1 solo como vista previa.
      </p>
    </div>
  );
}
