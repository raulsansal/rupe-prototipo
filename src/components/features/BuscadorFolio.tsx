"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { PATRON_FOLIO } from "@/mocks/tipos";

const ID_CAMPO = "campo-folio";

/** Buscador por folio (PUB-01, HU 025): Buscar y Limpiar. Valida el patrón RUPE-XXXXXXXX (8 letras o números, sin I ni O) y lleva a la ficha pública; si el folio no existe, la ficha responde 404 con «Folio no encontrado». */
export function BuscadorFolio() {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string>();

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const folio = valor.trim().toUpperCase();
    if (!folio) setError("Escribe el folio de la ficha.");
    else if (!PATRON_FOLIO.test(folio)) setError("El folio debe tener el formato RUPE-XXXXXXXX: 8 letras o números, sin I ni O.");
    else {
      setError(undefined);
      router.push(`/ficha/${folio}`);
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
        ayuda={error ? undefined : "Lo encuentras en la ficha de búsqueda, junto al código QR."}
        error={error}
      />
      <Boton type="submit" icono="search" className="md:mt-6">
        Buscar
      </Boton>
      <Boton type="button" variante="secundario" className="md:mt-6" onClick={limpiar}>
        Limpiar
      </Boton>
    </form>
  );
}
