// Base histórica de las estadísticas (P6c): los casos y avistamientos SINTÉTICOS de src/mocks/tablero.ts, asociados a identificadores del catálogo al sembrar (alcaldía y estado del animal por NOMBRE de los mocks,
// nunca por los del almacén editado) y congelados. Es inmutable: el tablero y los reportes le SUMAN la capa real (lo creado después de la siembra), pero ninguna acción la modifica.
import { AVISTAMIENTOS_TABLERO, CASOS_TABLERO } from "../../mocks/tablero";
import type { HechoAvistamiento, HechoCaso, Hechos } from "../dominio/estadisticas";
import type { Almacen } from "../memoria/almacen";

export function construirBaseHistorica(a: Almacen): Hechos {
  const alcaldia = new Map(a.alcaldias.map((x) => [x.nombre, x.idAlcaldia]));
  const estado = new Map(a.estadosAnimal.map((x) => [x.nombre, x.idEstadoAnimal]));
  const categorias = new Set(a.categoriasMotivo.map((c) => c.idCategoriaMotivo));
  const pedir = (m: Map<string, number>, nombre: string, que: string): number => {
    const id = m.get(nombre);
    if (id === undefined) throw new Error(`Base histórica: ${que} «${nombre}» no está en el catálogo`);
    return id;
  };
  const casos: HechoCaso[] = CASOS_TABLERO.map((c, i) => {
    if (!categorias.has(c.categoriaMotivo)) throw new Error(`Base histórica: categoría de motivo ${c.categoriaMotivo} fuera del catálogo`);
    const h: HechoCaso = { clave: `b${i}`, cuenta: true, dia: c.fecha, idAlcaldia: pedir(alcaldia, c.alcaldia, "alcaldía"), idCategoriaMotivo: c.categoriaMotivo, estado: c.estado };
    if (c.cierre && c.fechaCierre) h.cierre = { tipo: c.cierre, dia: c.fechaCierre };
    if (c.diasALocalizar !== undefined) h.diasALocalizar = c.diasALocalizar;
    return Object.freeze(h);
  });
  const avistamientos: HechoAvistamiento[] = AVISTAMIENTOS_TABLERO.map((v) =>
    Object.freeze({ dia: v.fecha, idAlcaldia: pedir(alcaldia, v.alcaldia, "alcaldía"), idsEstadoAnimal: Object.freeze(v.estados.map((n) => pedir(estado, n, "estado del animal"))), visible: v.visible, claveCaso: `b${v.casoIdx}` }),
  );
  return Object.freeze({ casos: Object.freeze(casos), avistamientos: Object.freeze(avistamientos) });
}
