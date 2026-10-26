"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { BotonIcono } from "@/components/ui/BotonIcono";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Modal } from "@/components/ui/Modal";
import { ModalAvisoActualizado } from "./ModalAvisoActualizado";

export type ModalAcceso = "bloqueo" | "deshabilitada" | "aviso-actualizado";

const REGEX_CORREO = /^[^@ ]+@[^@ ]+\.[^@ ]+$/; // la del diccionario (tbl_usuario.correo)

const AVISOS: Record<"bloqueo" | "deshabilitada", { titulo: string; texto: string; mensaje: string }> = {
  bloqueo: {
    titulo: "Acceso bloqueado temporalmente",
    texto: "Por seguridad, la cuenta se bloquea un rato cuando se escribe mal la contraseña varias veces.",
    mensaje: "5 intentos fallidos; intenta de nuevo en 15 minutos.",
  },
  deshabilitada: {
    titulo: "Cuenta deshabilitada",
    texto: "No puedes iniciar sesión con esta cuenta.",
    mensaje: "Tu cuenta está deshabilitada; contacta a quien administra RUPE.",
  },
};

type RespuestaAcceso = { destino?: string; error?: { codigo: string; mensaje: string; versionAviso?: string } };

/**
 * ACC-01 (HU 001): formulario de inicio de sesión conectado a POST /api/acceso/iniciar. Credenciales inválidas → error bajo «Contraseña» (mensaje uniforme);
 * cuenta bloqueada o deshabilitada → su aviso; aviso de privacidad actualizado → TRA-03 (reaceptación, R22). `siguiente` (ruta interna) se envía tal cual:
 * el servidor decide si es válida. `modalInicial` abre uno de los avisos al cargar: variante SOLO DE MAQUETADO (?estado=bloqueo|deshabilitada|aviso-actualizado)
 * para capturas; retirarla cuando todo el flujo esté conectado.
 */
export function FormularioAcceso({ modalInicial, siguiente }: { modalInicial?: ModalAcceso; siguiente?: string }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [errores, setErrores] = useState<{ correo?: string; contrasena?: string }>({});
  const [modal, setModal] = useState<ModalAcceso | undefined>(modalInicial);
  const [enviando, setEnviando] = useState(false);
  const [versionAviso, setVersionAviso] = useState<string>();
  const aviso = modal ?? modalInicial;
  // Un aviso abierto por la URL no tiene un botón al que devolver el foco: al cerrarlo va al primer campo.
  const abiertoPorUrl = useRef(modalInicial !== undefined);

  /** Pide iniciar sesión al servidor y reacciona a cada respuesta. */
  async function iniciar(aceptarAviso: boolean) {
    setEnviando(true);
    try {
      const r = await fetch("/api/acceso/iniciar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: correo.trim(), contrasena, aceptarAviso, siguiente }) });
      const datos = (await r.json().catch(() => ({}))) as RespuestaAcceso;
      if (r.ok && datos.destino) {
        router.push(datos.destino);
        router.refresh();
        return;
      }
      const codigo = datos.error?.codigo;
      setModal(codigo === "CUENTA_BLOQUEADA" ? "bloqueo" : codigo === "CUENTA_DESHABILITADA" ? "deshabilitada" : codigo === "AVISO_DESACTUALIZADO" ? "aviso-actualizado" : undefined);
      if (codigo === "AVISO_DESACTUALIZADO") setVersionAviso(datos.error?.versionAviso);
      else if (codigo !== "CUENTA_BLOQUEADA" && codigo !== "CUENTA_DESHABILITADA") {
        setErrores({ contrasena: datos.error?.mensaje ?? "No pudimos iniciar sesión. Inténtalo de nuevo." });
        document.getElementById("acceso-contrasena")?.focus();
      }
    } catch {
      setErrores({ contrasena: "No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setEnviando(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!correo.trim()) nuevos.correo = "Escribe tu correo electrónico.";
    else if (!REGEX_CORREO.test(correo.trim())) nuevos.correo = "Escribe un correo válido, como nombre@correo.com.";
    if (!contrasena) nuevos.contrasena = "Escribe tu contraseña.";
    setErrores(nuevos);
    if (nuevos.correo) return document.getElementById("acceso-correo")?.focus();
    if (nuevos.contrasena) return document.getElementById("acceso-contrasena")?.focus();
    void iniciar(false);
  }

  function cerrarModal() {
    setModal(undefined);
    if (abiertoPorUrl.current) {
      abiertoPorUrl.current = false;
      setTimeout(() => document.getElementById("acceso-correo")?.focus(), 0);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-h1">Iniciar sesión</h1>
      <form noValidate onSubmit={alEnviar} className="flex flex-col gap-4">
        <CampoTexto
          id="acceso-correo"
          etiqueta="Correo electrónico"
          type="email"
          name="correo"
          autoComplete="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
        />
        <div className="flex items-start gap-2">
          <CampoTexto
            id="acceso-contrasena"
            className="min-w-0 flex-1"
            etiqueta="Contraseña"
            type={mostrar ? "text" : "password"}
            name="contrasena"
            autoComplete="current-password"
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            error={errores.contrasena}
          />
          <BotonIcono
            icono={mostrar ? "visibility_off" : "visibility"}
            etiqueta="Mostrar contraseña"
            aria-pressed={mostrar}
            contorno
            onClick={() => setMostrar((m) => !m)}
            className="mt-[26px]"
          />
        </div>
        <Boton type="submit" tamano="grande" anchoCompleto cargando={enviando} textoCargando="Iniciando sesión…">
          Iniciar sesión
        </Boton>
        <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
          Cancelar
        </Link>
        <p className="text-center">
          <Link href="/recuperar-contrasena" className="inline-flex h-tactil items-center text-small font-semibold text-primary underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
      <section aria-labelledby="acceso-sin-cuenta" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="acceso-sin-cuenta" className="text-small font-bold">
          ¿Aún no tienes cuenta?
        </h2>
        <Link href="/registro" className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
          Crear cuenta de persona tutora
        </Link>
      </section>
      <Modal abierto={modal === "bloqueo" || modal === "deshabilitada"} onCerrar={cerrarModal} titulo={AVISOS[aviso === "deshabilitada" ? "deshabilitada" : "bloqueo"].titulo}>
        <p className="text-body text-text-muted">{AVISOS[aviso === "deshabilitada" ? "deshabilitada" : "bloqueo"].texto}</p>
        <Alerta tipo="advertencia" titulo="Aviso">
          {AVISOS[aviso === "deshabilitada" ? "deshabilitada" : "bloqueo"].mensaje}
        </Alerta>
        <Boton anchoCompleto onClick={cerrarModal} autoFocus>
          Entendido
        </Boton>
      </Modal>
      {/* TRA-03: la reaceptación del aviso ocurre al iniciar sesión; se muestra sobre esta misma pantalla. */}
      <ModalAvisoActualizado
        abierto={modal === "aviso-actualizado"}
        onCerrar={cerrarModal}
        version={versionAviso ? `v${versionAviso}` : undefined}
        enviando={enviando}
        // Con la variante de maquetado (sin credenciales escritas) solo se cierra; en el flujo real, aceptar registra la aceptación y entra.
        onAceptar={() => (correo.trim() && contrasena ? void iniciar(true) : cerrarModal())}
        onRechazar={cerrarModal}
      />
    </div>
  );
}
