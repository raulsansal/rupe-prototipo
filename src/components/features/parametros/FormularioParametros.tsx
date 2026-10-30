"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { CLAVES_PARAMETRO, LIMITE_TECNICO_MB, type ClaveParametro } from "@/config/parametros";
import { enviarAdmin } from "@/lib/clienteAdmin";
import { validarParametros, type ErroresParametros, type ValoresParametros } from "@/lib/parametros";
import type { ParametroAdmin } from "@/server/serializadores/admin";
import { ModalRestablecer } from "./ModalRestablecer";

type Props = { parametros: readonly ParametroAdmin[] };

type Aviso = { tipo: "exito" | "info" | "peligro"; titulo: string; texto: string };
const ID_CAMPO: Record<ClaveParametro, string> = { version_aviso_privacidad: "parametro-version", expiracion_token_minutos: "parametro-token", tamano_maximo_archivo_mb: "parametro-tamano" };
const EN_BITACORA = "El cambio se registra en la bitácora con el valor anterior y el nuevo.";
const deServidor = (p: readonly ParametroAdmin[], campo: "valor" | "valorPorDefecto"): ValoresParametros => Object.fromEntries(CLAVES_PARAMETRO.map((c) => [c, p.find((x) => x.clave === c)![campo]])) as ValoresParametros;

/**
 * ADM-11 (HU 054): tres parámetros con su valor por defecto bajo cada campo. Los valores vigentes y los de por defecto vienen del servidor; guardar y restablecer llaman a /api/admin/parametros
 * y refrescan con el estado real. Cambiar la versión del aviso avisa que todas las personas usuarias deberán aceptarlo de nuevo (R22). Cada cambio se registra en la bitácora con el valor
 * anterior y el nuevo. La expiración del token se guarda, pero la recuperación de contraseña no está en el Prototipo.
 */
export function FormularioParametros({ parametros }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const guardados = deServidor(parametros, "valor");
  const porDefecto = deServidor(parametros, "valorPorDefecto");
  const firma = JSON.stringify(guardados);
  const [firmaVista, setFirmaVista] = useState(firma);
  const [valores, setValores] = useState<ValoresParametros>(guardados);
  const [errores, setErrores] = useState<ErroresParametros>({});
  const [modal, setModal] = useState(false);
  // Mensaje en la página (no desaparece solo): se quita al editar cualquier campo.
  const [aviso, setAviso] = useState<Aviso>();
  // Si el servidor entrega otros valores (tras guardar o restablecer), el formulario los muestra.
  if (firma !== firmaVista) {
    setFirmaVista(firma);
    setValores(guardados);
  }

  const cambiaVersion = valores.version_aviso_privacidad.trim() !== guardados.version_aviso_privacidad;

  function cambiar(clave: ClaveParametro, valor: string) {
    setValores({ ...valores, [clave]: valor });
    setErrores({ ...errores, [clave]: undefined });
    setAviso(undefined);
  }

  async function guardar() {
    if (enviando.current) return;
    const e = validarParametros(valores);
    setErrores(e);
    const primero = CLAVES_PARAMETRO.find((c) => e[c]);
    if (primero) return document.getElementById(ID_CAMPO[primero])?.focus();
    enviando.current = true;
    try {
      const r = await enviarAdmin("/api/admin/parametros", "PUT", { ...valores, version_aviso_privacidad: valores.version_aviso_privacidad.trim() });
      if (r.ok) {
        if (r.datos?.sinCambios) setAviso({ tipo: "info", titulo: "Sin cambios", texto: "No hay cambios por guardar: los valores son los vigentes." });
        else
          setAviso({
            tipo: "exito",
            titulo: "Configuración guardada",
            texto: `${EN_BITACORA}${r.datos?.avisoReaceptacion ? " Las personas usuarias deberán aceptar la nueva versión del aviso en su siguiente inicio de sesión." : ""}`,
          });
        router.refresh();
        return;
      }
      if (r.campos) {
        const deCampos: ErroresParametros = {};
        for (const c of CLAVES_PARAMETRO) if (r.campos[c]) deCampos[c] = r.campos[c];
        setErrores(deCampos);
        const campo = CLAVES_PARAMETRO.find((c) => deCampos[c]);
        if (campo) return document.getElementById(ID_CAMPO[campo])?.focus();
      }
      if (r.estado === 401 || r.estado === 403) return router.refresh();
      setAviso({ tipo: "peligro", titulo: "No se pudo guardar", texto: r.mensaje ?? "Inténtalo de nuevo." });
    } finally {
      enviando.current = false;
    }
  }

  // EXTENSIÓN OPCIONAL a validar con Raúl (MOD-12): ver ModalRestablecer.
  async function restablecer() {
    if (enviando.current) return;
    enviando.current = true;
    try {
      const r = await enviarAdmin("/api/admin/parametros/restablecer", "POST", undefined);
      setModal(false);
      if (r.ok) {
        setErrores({});
        setAviso(r.datos?.sinCambios ? { tipo: "info", titulo: "Sin cambios", texto: "Los parámetros ya tenían sus valores por defecto." } : { tipo: "exito", titulo: "Valores restablecidos", texto: EN_BITACORA });
        router.refresh();
      } else setAviso({ tipo: "peligro", titulo: "No se pudo restablecer", texto: r.mensaje ?? "Inténtalo de nuevo." });
    } finally {
      enviando.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Parámetros del sistema</h1>
      {aviso && (
        <Alerta tipo={aviso.tipo} titulo={aviso.titulo} className="max-w-xl">
          {aviso.texto}
        </Alerta>
      )}
      <form
        aria-label="Parámetros del sistema"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
        className="flex max-w-xl flex-col gap-4 rounded-tarjeta border border-border bg-surface p-4"
      >
        <CampoTexto
          id={ID_CAMPO.version_aviso_privacidad}
          etiqueta="Versión vigente del aviso de privacidad"
          ayuda={`Valor por defecto: ${porDefecto.version_aviso_privacidad}`}
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
          ayuda={`Valor por defecto: ${porDefecto.expiracion_token_minutos}. Se guarda, pero la recuperación de contraseña aún no está en el prototipo, así que por ahora no tiene efecto.`}
          error={errores.expiracion_token_minutos}
          value={valores.expiracion_token_minutos}
          onChange={(e) => cambiar("expiracion_token_minutos", e.target.value)}
        />
        <CampoTexto
          id={ID_CAMPO.tamano_maximo_archivo_mb}
          etiqueta="Tamaño máximo de archivo permitido · MB"
          inputMode="decimal"
          ayuda={`Valor por defecto: ${porDefecto.tamano_maximo_archivo_mb} · máximo ${LIMITE_TECNICO_MB}`}
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
      <ModalRestablecer abierto={modal} onCerrar={() => setModal(false)} onConfirmar={() => void restablecer()} porDefecto={{ version: porDefecto.version_aviso_privacidad, token: porDefecto.expiracion_token_minutos, tamano: porDefecto.tamano_maximo_archivo_mb }} />
    </div>
  );
}
