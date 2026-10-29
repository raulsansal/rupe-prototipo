"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { PATRON_FOLIO } from "@/mocks/tipos";

const ID_CAMPO = "campo-folio";

/** A dónde lleva un folio válido: la ficha pública (PUB-01, HU 025), la consulta pública de estatus (HU 038) o esa misma consulta dentro de la plantilla de la persona tutora. */
const DESTINOS = {
  ficha: (folio: string) => `/ficha/${folio}`,
  estatus: (folio: string) => `/estatus/${folio}`,
  "estatus-tutora": (folio: string) => `/tutor/consultar-folio?folio=${folio}`,
} as const;
export type DestinoBuscador = keyof typeof DESTINOS;

/** Buscador por folio (PUB-01, HU 025): Buscar y Limpiar. Valida el patrón RUPE-XXXXXXXX (8 letras o números, sin I ni O) y lleva a la ficha pública; si el folio no existe, la ficha responde 404 con «Folio no encontrado». */
export function BuscadorFolio({ destino = "ficha", valorInicial = "" }: { destino?: DestinoBuscador; /** Folio con el que arranca el campo (la consulta de la persona tutora lo repite). */ valorInicial?: string } = {}) {
  const router = useRouter();
  const [valor, setValor] = useState(valorInicial);
  const [error, setError] = useState<string>();

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const folio = valor.trim().toUpperCase();
    if (!folio) setError("Escribe el folio de la ficha.");
    else if (!PATRON_FOLIO.test(folio)) setError("El folio debe tener el formato RUPE-XXXXXXXX: 8 letras o números, sin I ni O.");
    else {
      setError(undefined);
      router.push(DESTINOS[destino](folio));
      return;
    }
    document.getElementById(ID_CAMPO)?.focus();
  }

  function limpiar() {
    setValor("");
    setError(undefined);
    document.getElementById(ID_CAMPO)?.focus();
  }

  return (
    <form noValidate onSubmit={alEnviar} className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-start md:gap-4">
      <CampoTexto
        id={ID_CAMPO}
        etiqueta="Folio"
        name="folio"
        placeholder="RUPE-XXXXXXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        ayuda={error ? undefined : destino === "ficha" ? "Lo encuentras en la ficha de búsqueda, junto al código QR." : "Lo encuentras en la ficha de búsqueda, junto al código QR, o en el aviso de registro."}
        error={error}
      />
      <Boton type="submit" icono="search" className="md:mt-6">
        {destino === "ficha" ? "Buscar" : "Consultar folio"}
      </Boton>
      <Boton type="button" variante="secundario" className="md:mt-6" onClick={limpiar}>
        Limpiar
      </Boton>
    </form>
  );
}
