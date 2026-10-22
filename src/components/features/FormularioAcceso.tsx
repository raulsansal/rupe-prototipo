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

export type ModalAcceso = "bloqueo" | "deshabilitada";

const REGEX_CORREO = /^[^@ ]+@[^@ ]+\.[^@ ]+$/; // la del diccionario (tbl_usuario.correo)

const AVISOS: Record<ModalAcceso, { titulo: string; texto: string; mensaje: string }> = {
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

/**
 * ACC-01: formulario de inicio de sesión. Maqueta: no valida credenciales; «Iniciar sesión» lleva a /tutor.
 * `modalInicial` abre uno de los avisos al cargar (variante ?estado=bloqueo|deshabilitada).
 */
export function FormularioAcceso({ modalInicial }: { modalInicial?: ModalAcceso }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [errores, setErrores] = useState<{ correo?: string; contrasena?: string }>({});
  const [modal, setModal] = useState<ModalAcceso | undefined>(modalInicial);
  const aviso = modal ?? modalInicial;
  // Un aviso abierto por la URL no tiene un botón al que devolver el foco: al cerrarlo va al primer campo.
  const abiertoPorUrl = useRef(modalInicial !== undefined);

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!correo.trim()) nuevos.correo = "Escribe tu correo electrónico.";
    else if (!REGEX_CORREO.test(correo.trim())) nuevos.correo = "Escribe un correo válido, como nombre@correo.com.";
    if (!contrasena) nuevos.contrasena = "Escribe tu contraseña.";
    setErrores(nuevos);
    if (nuevos.correo) return document.getElementById("acceso-correo")?.focus();
    if (nuevos.contrasena) return document.getElementById("acceso-contrasena")?.focus();
    router.push("/tutor");
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
        <Boton type="submit" tamano="grande" anchoCompleto>
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
      <Modal abierto={modal !== undefined} onCerrar={cerrarModal} titulo={AVISOS[aviso ?? "bloqueo"].titulo}>
        <p className="text-body text-text-muted">{AVISOS[aviso ?? "bloqueo"].texto}</p>
        <Alerta tipo="advertencia" titulo="Aviso">
          {AVISOS[aviso ?? "bloqueo"].mensaje}
        </Alerta>
        <Boton anchoCompleto onClick={cerrarModal} autoFocus>
          Entendido
        </Boton>
      </Modal>
    </div>
  );
}
