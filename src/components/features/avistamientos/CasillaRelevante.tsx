"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Casilla } from "@/components/ui/Casilla";

/**
 * HU 040: «Marcar como relevante», reversible y solo para la persona dueña (la marca no sale en ninguna respuesta pública ni de Administrador). Se guarda con PUT; si falla, la casilla vuelve a
 * su valor y se avisa. El anuncio para lectores de pantalla va en una región ya montada.
 */
export function CasillaRelevante({ folio, id, relevante }: { folio: string; id: number; relevante: boolean }) {
  const router = useRouter();
  const [marcada, setMarcada] = useState(relevante);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string>();

  async function alCambiar(valor: boolean) {
    if (enviando) return;
    setMarcada(valor);
    setEnviando(true);
    setError(undefined);
    try {
      const r = await fetch(`/api/casos/${folio}/avistamientos/${id}/relevante`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relevante: valor }) });
      if (!r.ok) throw new Error(String(r.status));
      setMensaje(valor ? "Avistamiento marcado como relevante" : "Avistamiento sin marca de relevante");
      router.refresh();
    } catch {
      setMarcada(!valor);
      setError("No se pudo guardar la marca. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-tarjeta border border-border bg-surface p-4">
      <Casilla etiqueta="Marcar como relevante" checked={marcada} disabled={enviando} onChange={(e) => alCambiar(e.target.checked)} ayuda="Solo tú ves esta marca; te sirve para encontrar después los avistamientos que más te importan." error={error} />
      <p role="status" aria-live="polite" className="sr-only">
        {mensaje}
      </p>
    </div>
  );
}
