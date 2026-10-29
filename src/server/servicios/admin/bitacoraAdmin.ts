import "server-only";
// HU 058 (P6a): consulta de la bitácora de acciones administrativas. Solo el Administrador; solo lectura (R15: el repositorio solo expone agregar y leer, y lee COPIAS). Más reciente primero, páginas de 8,
// filtros por tipo y por día de la Ciudad de México validados aquí. En el almacén la entidad afectada es el id del diccionario; al LEER se muestra el folio del caso, el nombre del valor de catálogo, etc.
import { diaCDMX, validarRangoDeDias } from "../../dominio/filtrosAvistamientos";
import { ENTIDAD_DE_TIPO, TIPOS_ACCION, type TipoAccion } from "../../dominio/bitacora";
import { paginar } from "../../dominio/paginacion";
import { aEntradaBitacora, type EntradaBitacoraVista } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";

const POR_PAGINA = 8;
const NOMBRE_DE_CATALOGO: Record<string, string> = { alcaldia: "Alcaldías", raza: "Razas", motivo: "Motivos", estado_animal: "Estados del animal" };

export type ListadoDeBitacora = { items: EntradaBitacoraVista[]; pagina: number; totalPaginas: number; total: number; porPagina: number; filtros: { tipo?: TipoAccion; desde?: string; hasta?: string }; errores: { tipo?: string; desde?: string; hasta?: string }; tipos: readonly TipoAccion[] };

export async function consultarBitacora(sesion: SesionActual | undefined, entrada: { tipo?: unknown; desde?: unknown; hasta?: unknown; pagina?: unknown } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ListadoDeBitacora> {
  exigirAdministrador(sesion);
  const { repos } = ctx;
  const filtros: ListadoDeBitacora["filtros"] = {};
  const errores: ListadoDeBitacora["errores"] = {};
  const t = typeof entrada.tipo === "string" ? entrada.tipo.trim() : "";
  if ((TIPOS_ACCION as readonly string[]).includes(t)) filtros.tipo = t as TipoAccion;
  else if (t) errores.tipo = "Elige un tipo de acción de la lista.";
  const rango = validarRangoDeDias(entrada);
  Object.assign(filtros, { ...(rango.desde ? { desde: rango.desde } : {}), ...(rango.hasta ? { hasta: rango.hasta } : {}) });
  Object.assign(errores, rango.errores);

  const [todas, usuarios, casos, avistamientos, alcaldias, razas, motivos, estados] = [await repos.bitacora.todas(), await repos.usuarios.todos(), await repos.casos.todos(), await repos.avistamientos.todos(), await repos.catalogos.alcaldias(), await repos.catalogos.razas(), await repos.catalogos.motivos(), await repos.catalogos.estadosAnimal()];
  const foliosPorId = new Map(casos.map((c) => [c.idCasoExtravio, c.folio]));
  const nombres: Record<string, Map<number, string>> = {
    alcaldia: new Map(alcaldias.map((x) => [x.idAlcaldia, x.nombre])), raza: new Map(razas.map((x) => [x.idRaza, x.nombre])), motivo: new Map(motivos.map((x) => [x.idMotivo, x.nombre])), estado_animal: new Map(estados.map((x) => [x.idEstadoAnimal, x.nombre])),
  };
  const nombreDeUsuario = new Map(usuarios.map((u) => [u.idUsuario, u.nombreCompleto]));
  const casoDeAvistamiento = new Map(avistamientos.map((a) => [a.idAvistamiento, a.idCasoExtravio]));

  /** Entidad afectada legible: folio del caso, «Avistamiento N · folio», nombre del usuario, valor del catálogo o clave del parámetro. */
  const legible = (tipo: TipoAccion, id: string): string => {
    switch (ENTIDAD_DE_TIPO[tipo]) {
      case "caso":
        return foliosPorId.get(Number(id)) ?? `Caso ${id}`;
      case "avistamiento": {
        const folio = foliosPorId.get(casoDeAvistamiento.get(Number(id)) ?? -1);
        return folio ? `Avistamiento ${id} · ${folio}` : `Avistamiento ${id}`;
      }
      case "usuario":
        return `${nombreDeUsuario.get(Number(id)) ?? "Usuario"} (${id})`;
      case "catálogo": {
        const [etiqueta, n] = id.split(":");
        return `${NOMBRE_DE_CATALOGO[etiqueta] ?? etiqueta} · ${nombres[etiqueta]?.get(Number(n)) ?? n} (${n})`;
      }
      default:
        return id; // parámetro: su clave
    }
  };

  const filtradas = todas
    .filter((b) => (!filtros.tipo || b.tipoAccion === filtros.tipo) && (!filtros.desde || diaCDMX(b.fechaHora) >= filtros.desde) && (!filtros.hasta || diaCDMX(b.fechaHora) <= filtros.hasta))
    .sort((x, y) => y.fechaHora.localeCompare(x.fechaHora) || y.idBitacoraAdmin - x.idBitacoraAdmin);
  const p = paginar(filtradas, entrada.pagina, POR_PAGINA);
  const items = p.items.map((b) =>
    aEntradaBitacora({
      id: b.idBitacoraAdmin, fechaHora: b.fechaHora, tipo: b.tipoAccion, entidad: ENTIDAD_DE_TIPO[b.tipoAccion], idAfectada: b.idAfectada, entidadAfectada: legible(b.tipoAccion, b.idAfectada), motivo: b.motivo, detalle: b.detalle,
      administrador: nombreDeUsuario.get(b.idUsuario) ?? "",
    }),
  );
  return { ...p, items, filtros, errores, tipos: TIPOS_ACCION };
}
