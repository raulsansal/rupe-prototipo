import { cx } from "@/lib/clases";

export type VarianteBoton = "primario" | "secundario" | "terciario" | "destructivo";
export type TamanoBoton = "estandar" | "grande";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-boton text-small font-semibold transition-colors motion-reduce:transition-none disabled:cursor-not-allowed";

// Estados: hover (escritorio) y active (equivalente presionado en móvil); data-estado solo lo usa la galería.
const VARIANTES: Record<VarianteBoton, string> = {
  primario:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed data-[estado=hover]:bg-primary-hover data-[estado=presionado]:bg-primary-pressed disabled:bg-disabled-bg disabled:text-disabled-text",
  secundario:
    "borde-campo border-primary bg-transparent text-primary hover:bg-primary-soft active:bg-primary-soft data-[estado=hover]:bg-primary-soft data-[estado=presionado]:bg-primary-soft disabled:border-border-strong disabled:bg-transparent disabled:text-disabled-text",
  terciario:
    "bg-transparent text-primary hover:bg-primary-soft hover:underline active:bg-primary-soft active:underline data-[estado=hover]:bg-primary-soft data-[estado=hover]:underline data-[estado=presionado]:bg-primary-soft data-[estado=presionado]:underline disabled:bg-transparent disabled:text-disabled-text disabled:no-underline",
  // Hover y presionado usan estado-extraviado-fg (rojo oscuro en claro, rosa claro en oscuro); presionado, además, un poco más intenso.
  destructivo:
    "bg-danger text-on-primary hover:bg-estado-extraviado-fg active:bg-estado-extraviado-fg active:brightness-90 data-[estado=hover]:bg-estado-extraviado-fg data-[estado=presionado]:bg-estado-extraviado-fg data-[estado=presionado]:brightness-90 disabled:bg-disabled-bg disabled:text-disabled-text",
};

const TAMANOS: Record<TamanoBoton, string> = {
  estandar: "h-boton px-5",
  grande: "h-boton-grande px-6 text-body",
};

export type OpcionesClases = { variante?: VarianteBoton; tamano?: TamanoBoton; anchoCompleto?: boolean; className?: string };

/** Clases del botón, para dar su aspecto a un enlace (<Link>) sin duplicar estilos. */
export function clasesBoton({ variante = "primario", tamano = "estandar", anchoCompleto, className }: OpcionesClases = {}) {
  return cx(BASE, VARIANTES[variante], TAMANOS[tamano], anchoCompleto && "w-full", className);
}
