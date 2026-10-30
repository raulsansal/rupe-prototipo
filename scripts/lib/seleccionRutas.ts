// Qué entradas de capturas.config.ts se capturan según --rutas (por prefijo) y --rutas-exactas (la ruta completa, con su consulta, es una de las dadas).
// Si se pasan las dos, deben cumplirse las dos. Sin ninguna se capturan todas.
export type FiltroDeRutas = { prefijo?: string; exactas?: readonly string[] };

/** Valor de `--nombre=...` (todo lo que sigue al PRIMER «=», porque una ruta puede llevar «?desde=…»). */
export function valorDeOpcion(argv: readonly string[], nombre: string): string | undefined {
  const a = argv.find((x) => x.startsWith(`--${nombre}=`));
  return a === undefined ? undefined : a.slice(nombre.length + 3);
}

export const filtroDeArgumentos = (argv: readonly string[]): FiltroDeRutas => ({
  prefijo: valorDeOpcion(argv, "rutas"),
  exactas: valorDeOpcion(argv, "rutas-exactas")?.split(",").filter(Boolean),
});

export const hayFiltroDeRutas = (f: FiltroDeRutas) => f.prefijo !== undefined || f.exactas !== undefined;

export const seleccionaRuta = (ruta: string, f: FiltroDeRutas): boolean => (f.prefijo === undefined || ruta.startsWith(f.prefijo)) && (f.exactas === undefined || f.exactas.includes(ruta));
