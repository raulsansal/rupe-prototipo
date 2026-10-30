import "server-only";
// Excel de la exportación (HU 057) con write-excel-file (solo Node). Todo TEXTO pasa por `neutralizar`; las cifras van como números. Una hoja de resumen y una por desglose.
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/node";
import type { ContenidoDeReporte } from "./contenidoDeReporte";
import { neutralizar } from "./neutralizar";

const texto = (v: string, extra: object = {}): Cell => ({ value: neutralizar(v), type: String, ...extra });
const negrita = (v: string): Cell => texto(v, { fontWeight: "bold" });
const numero = (v: number | null, formato?: string): Cell => (v === null ? texto("—") : { value: v, type: Number, ...(formato ? { format: formato } : {}) });

export async function generarXlsx(c: ContenidoDeReporte): Promise<Uint8Array> {
  const resumen: SheetData = [
    [negrita(c.titulo)],
    [texto("Generado"), texto(c.generado)],
    [],
    [negrita("Filtros aplicados")],
    ...c.filtros.map(([k, v]): Cell[] => [texto(k), texto(v)]),
    [],
    [negrita("Indicadores")],
    ...c.indicadores.map((i): Cell[] => [texto(i.rotulo), numero(i.valor, i.tipo === "porcentaje" ? "0.0" : undefined)]),
    [],
    ...c.notas.map((n): Cell[] => [texto(n)]),
  ];
  const hojas = [
    { sheet: "Resumen", data: resumen, columns: [{ width: 34 }, { width: 44 }] },
    ...c.tablas.map((t) => ({ sheet: t.hoja, data: [[negrita(t.columnas[0]), negrita(t.columnas[1])], ...t.filas.map(([k, v]): Cell[] => [texto(k), numero(v)])] as SheetData, columns: [{ width: 52 }, { width: 16 }] })),
  ];
  return await writeXlsxFile(hojas).toBuffer();
}
