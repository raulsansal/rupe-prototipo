import Link from "next/link";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Selector } from "@/components/ui/Selector";

type Props = {
  /** Ruta del listado: «Limpiar filtros» vuelve a ella y el formulario se envía con GET, así los filtros viven en la URL. */
  base: string;
  /** Fecha de registro del caso (AAAA-MM-DD, día de la Ciudad de México): el rango no puede ser anterior (HU 041). */
  desdeMinimo: string;
  /** Lo que llegó en la URL (texto tal cual), para repetirlo en el formulario aunque sea inválido. */
  valores: { desde: string; hasta: string; alcaldia: string };
  /** Errores por campo calculados en el SERVIDOR. */
  errores: { desde?: string; hasta?: string; alcaldia?: string };
  /** Catálogo de alcaldías, con «Fuera de la Ciudad de México». */
  alcaldias: { id: number; nombre: string }[];
};

/**
 * HU 041: filtros del listado de avistamientos. Un formulario GET: los parámetros `desde`, `hasta` y `alcaldia` (id del catálogo) van en la URL, el servidor los valida SIEMPRE y el listado se
 * arma con ellos. «Aplicar filtros» envía el formulario; «Limpiar filtros» vuelve al listado sin parámetros. Funciona sin JavaScript.
 */
export function FiltrosAvistamientos({ base, desdeMinimo, valores, errores, alcaldias }: Props) {
  return (
    <form method="get" action={base} noValidate className="flex flex-col gap-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto id="filtro-desde" name="desde" etiqueta="Desde" type="date" min={desdeMinimo} defaultValue={valores.desde} error={errores.desde} />
        <CampoTexto id="filtro-hasta" name="hasta" etiqueta="Hasta" type="date" min={desdeMinimo} defaultValue={valores.hasta} error={errores.hasta} />
      </div>
      <Selector id="filtro-alcaldia" name="alcaldia" etiqueta="Alcaldía o zona" marcador="Todas" opciones={alcaldias.map((a) => ({ valor: String(a.id), etiqueta: a.nombre }))} defaultValue={valores.alcaldia} error={errores.alcaldia} />
      <div className="grid grid-cols-2 gap-3">
        <Link href={base} className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
          Limpiar filtros
        </Link>
        <Boton type="submit">Aplicar filtros</Boton>
      </div>
    </form>
  );
}
