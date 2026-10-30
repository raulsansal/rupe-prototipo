import "server-only";
// HU 053 (P6b): estados del caso, SOLO CONSULTA. Los 6 los define el sistema: no hay servicio ni ruta que los agregue, edite, desactive o elimine, y el repositorio solo los lee.
import { aEstadoCasoAdmin, type EstadoCasoAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";

export async function listarEstadosCaso(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<{ items: EstadoCasoAdmin[] }> {
  exigirAdministrador(sesion);
  return { items: (await ctx.repos.catalogos.estadosCaso()).sort((a, b) => a.orden - b.orden).map((e) => aEstadoCasoAdmin({ id: e.idEstadoCaso, nombre: e.nombre, orden: e.orden })) };
}
