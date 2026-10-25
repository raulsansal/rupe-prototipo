"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { LIMITE_TECNICO_MB, validarParametros, VALORES_POR_DEFECTO, type ErroresParametros, type ValoresParametros } from "@/lib/parametros";
import { ModalRestablecer } from "./ModalRestablecer";

type Props = {
  /** Capturas y pruebas: valores con los que abre el formulario (los guardados siguen siendo los de por defecto). */
  valoresIniciales?: ValoresParametros;
  /** Capturas y pruebas: abre con los errores de validación ya mostrados. */
  validarAlCargar?: boolean;
  /** Capturas y pruebas: abre el modal MOD-12. */
  restablecerAbierto?: boolean;
  /** Capturas y pruebas: abre con esos valores ya guardados y el mensaje de éxito. */
  guardadoInicial?: boolean;
};

const EXITO_GUARDADO = { titulo: "Configuración guardada", texto: "El cambio se registra en la bitácora con el valor anterior y el nuevo." };
const CLAVES = ["version_aviso_privacidad", "expiracion_token_minutos", "tamano_maximo_archivo_mb"] as const;
const ID_CAMPO: Record<(typeof CLAVES)[number], string> = { version_aviso_privacidad: "parametro-version", expiracion_token_minutos: "parametro-token", tamano_maximo_archivo_mb: "parametro-tamano" };

/**
 * ADM-11 (HU 054): tres parámetros con su valor por defecto bajo cada campo. Cambiar la versión del aviso avisa que todas las personas
 * usuarias deberán aceptarlo de nuevo (R22). Cada cambio se registra en la bitácora con el valor anterior y el nuevo (aquí solo se avisa).
 */
export function FormularioParametros({ valoresIniciales = { ...VALORES_POR_DEFECTO }, validarAlCargar = false, restablecerAbierto = false, guardadoInicial = false }: Props) {
  const [guardados, setGuardados] = useState<ValoresParametros>(guardadoInicial ? valoresIniciales : { ...VALORES_POR_DEFECTO });
  const [valores, setValores] = useState<ValoresParametros>(valoresIniciales);
  const [errores, setErrores] = useState<ErroresParametros>(validarAlCargar ? validarParametros(valoresIniciales) : {});
  const [modal, setModal] = useState(restablecerAbierto);
  // Mensaje de éxito en la página (no desaparece solo): se quita al editar cualquier campo.
  const [aviso, setAviso] = useState<{ titulo: string; texto: string } | undefined>(guardadoInicial ? EXITO_GUARDADO : undefined);

  const cambiaVersion = valores.version_aviso_privacidad.trim() !== guardados.version_aviso_privacidad;

  function cambiar(clave: (typeof CLAVES)[number], valor: string) {
    setValores({ ...valores, [clave]: valor });
    setErrores({ ...errores, [clave]: undefined });
    setAviso(undefined);
  }

  function guardar() {
    const e = validarParametros(valores);
    setErrores(e);
    const primero = CLAVES.find((c) => e[c]);
    if (primero) return document.getElementById(ID_CAMPO[primero])?.focus();
    const limpios = { ...valores, version_aviso_privacidad: valores.version_aviso_privacidad.trim() };
    const cambiados = CLAVES.filter((c) => limpios[c] !== guardados[c]);
    setGuardados(limpios);
    setValores(limpios);
    setAviso(cambiados.length ? EXITO_GUARDADO : { titulo: "Sin cambios", texto: "No hay cambios por guardar: los valores son los vigentes." });
  }

  // EXTENSIÓN OPCIONAL a validar con Raúl (MOD-12): ver ModalRestablecer.
  function restablecer() {
    setValores({ ...VALORES_POR_DEFECTO });
    setGuardados({ ...VALORES_POR_DEFECTO });
    setErrores({});
    setModal(false);
    setAviso({ titulo: "Valores restablecidos", texto: "El cambio se registra en la bitácora con el valor anterior y el nuevo." });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Parámetros del sistema</h1>
      {aviso && (
        <Alerta tipo={aviso.titulo === "Sin cambios" ? "info" : "exito"} titulo={aviso.titulo} className="max-w-xl">
          {aviso.texto}
        </Alerta>
      )}
      <form
        aria-label="Parámetros del sistema"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        className="flex max-w-xl flex-col gap-4 rounded-tarjeta border border-border bg-surface p-4"
      >
        <CampoTexto
          id={ID_CAMPO.version_aviso_privacidad}
          etiqueta="Versión vigente del aviso de privacidad"
          ayuda={`Valor por defecto: ${VALORES_POR_DEFECTO.version_aviso_privacidad}`}
          error={errores.version_aviso_privacidad}
          value={valores.version_aviso_privacidad}
          onChange={(e) => cambiar("version_aviso_privacidad", e.target.value)}
        />
        {cambiaVersion && (
          <Alerta tipo="advertencia" titulo="Re-aceptación del aviso">
            Al cambiar la versión del aviso de privacidad, todas las personas usuarias deberán aceptarlo de nuevo.
          </Alerta>
        )}
        <CampoTexto
          id={ID_CAMPO.expiracion_token_minutos}
          etiqueta="Tiempo de expiración del token de recuperación · minutos"
          inputMode="numeric"
          ayuda={`Valor por defecto: ${VALORES_POR_DEFECTO.expiracion_token_minutos}`}
          error={errores.expiracion_token_minutos}
          value={valores.expiracion_token_minutos}
          onChange={(e) => cambiar("expiracion_token_minutos", e.target.value)}
        />
        <CampoTexto
          id={ID_CAMPO.tamano_maximo_archivo_mb}
          etiqueta="Tamaño máximo de archivo permitido · MB"
          inputMode="decimal"
          ayuda={`Valor por defecto: ${VALORES_POR_DEFECTO.tamano_maximo_archivo_mb} · máximo ${LIMITE_TECNICO_MB}`}
          error={errores.tamano_maximo_archivo_mb}
          value={valores.tamano_maximo_archivo_mb}
          onChange={(e) => cambiar("tamano_maximo_archivo_mb", e.target.value)}
        />
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Boton type="submit" anchoCompleto>
            Guardar configuración
          </Boton>
          {/* EXTENSIÓN OPCIONAL a validar con Raúl (MOD-12): retirar este botón con ModalRestablecer. */}
          <Boton variante="secundario" anchoCompleto onClick={() => setModal(true)}>
            Restablecer valores por defecto
          </Boton>
        </div>
      </form>
      <ModalRestablecer abierto={modal} onCerrar={() => setModal(false)} onConfirmar={restablecer} />
    </div>
  );
}
