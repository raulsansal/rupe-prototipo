// Llamadas del navegador a las rutas /api/admin (P6a). Las pantallas del Administrador solo MUESTRAN lo que el servidor devuelve: tras cada acción llaman a `router.refresh()`.
export type RespuestaAdmin = { ok: boolean; estado: number; codigo?: string; mensaje?: string; datos?: Record<string, unknown> };

export const MENSAJE_YA_CAMBIO = "Ya había cambiado. Se actualizó la pantalla con su estado actual.";
export const MENSAJE_SIN_CONEXION = "No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.";

export async function enviarAdmin(ruta: string, metodo: "POST" | "PUT", cuerpo: unknown): Promise<RespuestaAdmin> {
  try {
    const r = await fetch(ruta, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const json = (await r.json().catch(() => undefined)) as { error?: { codigo?: string; mensaje?: string } } & Record<string, unknown>;
    if (r.ok) return { ok: true, estado: r.status, datos: json };
    return { ok: false, estado: r.status, codigo: json?.error?.codigo, mensaje: json?.error?.mensaje };
  } catch {
    return { ok: false, estado: 0, mensaje: MENSAJE_SIN_CONEXION };
  }
}

/** URL de un listado con sus parámetros (los vacíos se omiten) y la página pedida. */
export function urlConPagina(base: string, parametros: Record<string, string | undefined>, pagina: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) if (v) q.set(k, v);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
