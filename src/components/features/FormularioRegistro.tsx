"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { BotonIcono } from "@/components/ui/BotonIcono";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Casilla } from "@/components/ui/Casilla";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { ModalAvisoPrivacidad } from "./ModalAvisoPrivacidad";

const REGEX_CORREO = /^[^@ ]+@[^@ ]+\.[^@ ]+$/; // tbl_usuario.correo
const REGEX_TELEFONO = /^[0-9]{10,15}$/; // tbl_usuario.telefono
/** Longitudes del diccionario: nombre_completo 150, correo 254, telefono 15. */
const MAX = { nombre: 150, correo: 254, telefono: 15 } as const;

type Errores = Partial<Record<"nombre" | "correo" | "contrasena" | "telefono" | "aviso", string>>;

/**
 * ACC-02 (HU 002 y 003): registro de la persona tutora conectado a POST /api/acceso/registrar (valida el servidor y se muestran sus errores por campo).
 * El registro no se completa sin aceptar el aviso de privacidad. `versionAviso` es la vigente (parámetro del servidor); `avisoAbiertoInicial` abre MOD-01
 * al cargar (capturas).
 */
export function FormularioRegistro({ avisoAbiertoInicial = false, versionAviso }: { avisoAbiertoInicial?: boolean; versionAviso: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [aceptado, setAceptado] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState(avisoAbiertoInicial);
  const version = `v${versionAviso}`;
  const [enviando, setEnviando] = useState(false);

  const quitar = (k: keyof Errores) => setErrores((e) => ({ ...e, [k]: undefined }));

  async function registrar() {
    setEnviando(true);
    try {
      const r = await fetch("/api/acceso/registrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim(), correo: correo.trim(), contrasena, telefono, aceptaAviso: aceptado, versionAviso }) });
      const datos = (await r.json().catch(() => ({}))) as { destino?: string; error?: { codigo: string; mensaje: string; campos?: Errores } };
      if (r.ok && datos.destino) {
        router.push(datos.destino);
        router.refresh();
        return;
      }
      let n: Errores = datos.error?.campos ?? {};
      if (datos.error?.codigo === "AVISO_DESACTUALIZADO") {
        setAceptado(false);
        n = { aviso: "El aviso de privacidad cambió: revísalo y acéptalo de nuevo." };
      } else if (!Object.keys(n).length) n = { correo: datos.error?.mensaje ?? "No pudimos completar el registro. Inténtalo de nuevo." };
      setErrores(n);
      const primero = (["nombre", "correo", "contrasena", "telefono", "aviso"] as const).find((k) => n[k]);
      if (primero) document.getElementById(`registro-${primero}`)?.focus();
    } catch {
      setErrores({ correo: "No pudimos completar el registro. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setEnviando(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const n: Errores = {};
    if (!nombre.trim()) n.nombre = "Escribe tu nombre completo.";
    if (!correo.trim()) n.correo = "Escribe tu correo electrónico.";
    else if (!REGEX_CORREO.test(correo.trim())) n.correo = "Escribe un correo válido, como nombre@correo.com.";
    if (contrasena.length < 8 || !/\p{L}/u.test(contrasena) || !/\p{Nd}/u.test(contrasena)) n.contrasena = "La contraseña debe tener mínimo 8 caracteres, con letras y números.";
    if (!telefono) n.telefono = "Escribe tu teléfono de contacto.";
    else if (!REGEX_TELEFONO.test(telefono)) n.telefono = "El teléfono debe tener de 10 a 15 dígitos, sin espacios ni guiones.";
    if (!aceptado) n.aviso = `Debes aceptar el aviso de privacidad ${version} para registrarte.`;
    setErrores(n);
    const primero = (["nombre", "correo", "contrasena", "telefono", "aviso"] as const).find((k) => n[k]);
    if (primero) return document.getElementById(`registro-${primero}`)?.focus();
    void registrar();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-h1">Crear cuenta de persona tutora</h1>
      <form noValidate onSubmit={alEnviar} className="flex flex-col gap-4">
        <CampoTexto
          id="registro-nombre"
          etiqueta="Nombre completo"
          name="nombre"
          autoComplete="name"
          required
          maxLength={MAX.nombre}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            quitar("nombre");
          }}
          error={errores.nombre}
        />
        <CampoTexto
          id="registro-correo"
          etiqueta="Correo electrónico"
          type="email"
          name="correo"
          autoComplete="email"
          required
          maxLength={MAX.correo}
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            quitar("correo");
          }}
          error={errores.correo}
        />
        <div className="flex items-start gap-2">
          <CampoTexto
            id="registro-contrasena"
            className="min-w-0 flex-1"
            etiqueta="Contraseña"
            type={mostrar ? "text" : "password"}
            name="contrasena"
            autoComplete="new-password"
            required
            ayuda="Mínimo 8 caracteres con letras y números."
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              quitar("contrasena");
            }}
            error={errores.contrasena}
          />
          <BotonIcono icono={mostrar ? "visibility_off" : "visibility"} etiqueta="Mostrar contraseña" aria-pressed={mostrar} contorno onClick={() => setMostrar((m) => !m)} className="mt-[26px]" />
        </div>
        <CampoTexto
          id="registro-telefono"
          etiqueta="Teléfono de contacto"
          type="tel"
          inputMode="numeric"
          name="telefono"
          autoComplete="tel"
          required
          maxLength={MAX.telefono}
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value);
            quitar("telefono");
          }}
          error={errores.telefono}
        />
        <p className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">El teléfono se reserva y no se publica en la ficha.</p>
        <Casilla
          id="registro-aviso"
          checked={aceptado}
          onChange={(e) => {
            setAceptado(e.target.checked);
            quitar("aviso");
          }}
          etiqueta={
            <>
              He leído y acepto el{" "}
              <Link
                href="/#aviso-de-privacidad"
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.preventDefault();
                  setAviso(true);
                }}
                className="font-semibold text-primary underline"
              >
                Aviso de privacidad {version}
              </Link>
            </>
          }
          error={errores.aviso}
        />
        <Boton type="submit" tamano="grande" anchoCompleto cargando={enviando} textoCargando="Registrando…">
          Registrarse
        </Boton>
        <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
          Cancelar
        </Link>
      </form>
      {!aceptado && errores.aviso === undefined && (
        <Alerta tipo="info" titulo="El aviso de privacidad es obligatorio">
          El registro no se completa sin aceptarlo.
        </Alerta>
      )}
      <ModalAvisoPrivacidad
        abierto={aviso}
        onCerrar={() => setAviso(false)}
        modo="registro"
        version={version}
        onAceptar={() => {
          setAceptado(true);
          quitar("aviso");
          setAviso(false);
        }}
        onRechazar={() => {
          setAceptado(false);
          setAviso(false);
        }}
      />
    </div>
  );
}
