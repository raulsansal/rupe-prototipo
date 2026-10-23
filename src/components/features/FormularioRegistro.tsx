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
import { etiquetaVersionAviso } from "@/mocks/parametros";
import { ModalAvisoPrivacidad } from "./ModalAvisoPrivacidad";

const REGEX_CORREO = /^[^@ ]+@[^@ ]+\.[^@ ]+$/; // tbl_usuario.correo
const REGEX_TELEFONO = /^[0-9]{10,15}$/; // tbl_usuario.telefono
/** Longitudes del diccionario: nombre_completo 150, correo 254, telefono 15. */
const MAX = { nombre: 150, correo: 254, telefono: 15 } as const;

type Errores = Partial<Record<"nombre" | "correo" | "contrasena" | "telefono" | "aviso", string>>;

/**
 * ACC-02: registro de la persona tutora. Maqueta: no crea ninguna cuenta; «Registrarse» lleva a /tutor. El registro no se
 * completa sin aceptar el aviso de privacidad (HU 002 y 003). `avisoAbiertoInicial` abre MOD-01 al cargar (capturas).
 */
export function FormularioRegistro({ avisoAbiertoInicial = false }: { avisoAbiertoInicial?: boolean }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [aceptado, setAceptado] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState(avisoAbiertoInicial);
  const version = etiquetaVersionAviso();

  const quitar = (k: keyof Errores) => setErrores((e) => ({ ...e, [k]: undefined }));

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const n: Errores = {};
    if (!nombre.trim()) n.nombre = "Escribe tu nombre completo.";
    if (!correo.trim()) n.correo = "Escribe tu correo electrónico.";
    else if (!REGEX_CORREO.test(correo.trim())) n.correo = "Escribe un correo válido, como nombre@correo.com.";
    if (contrasena.length < 8 || !/[A-Za-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) n.contrasena = "La contraseña debe tener mínimo 8 caracteres, con letras y números.";
    if (!telefono) n.telefono = "Escribe tu teléfono de contacto.";
    else if (!REGEX_TELEFONO.test(telefono)) n.telefono = "El teléfono debe tener de 10 a 15 dígitos, sin espacios ni guiones.";
    if (!aceptado) n.aviso = `Debes aceptar el aviso de privacidad ${version} para registrarte.`;
    setErrores(n);
    const primero = (["nombre", "correo", "contrasena", "telefono", "aviso"] as const).find((k) => n[k]);
    if (primero) return document.getElementById(`registro-${primero}`)?.focus();
    router.push("/tutor");
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
        <Boton type="submit" tamano="grande" anchoCompleto>
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
