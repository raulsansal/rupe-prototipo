// Paginación del lado del servidor (P6): la página llega de la URL como texto sin confiar; una inválida es la 1 y una que se pasa del final es la última.
export type Pagina<T> = { items: T[]; pagina: number; totalPaginas: number; total: number; porPagina: number };

export function paginar<T>(items: readonly T[], paginaSolicitada: unknown, porPagina: number): Pagina<T> {
  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const n = typeof paginaSolicitada === "string" && /^\d{1,6}$/.test(paginaSolicitada) ? Number(paginaSolicitada) : typeof paginaSolicitada === "number" && Number.isInteger(paginaSolicitada) ? paginaSolicitada : 1;
  const pagina = Math.min(Math.max(n, 1), totalPaginas);
  return { items: items.slice((pagina - 1) * porPagina, pagina * porPagina), pagina, totalPaginas, total, porPagina };
}
