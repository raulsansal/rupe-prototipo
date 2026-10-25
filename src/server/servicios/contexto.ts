import "server-only";
import { crearRepositorios } from "../memoria/repos";
import type { Repositorios } from "../repos";
import { relojDelSistema, type Reloj } from "../dominio/fechas";
import type { Aleatorio } from "../dominio/folio";
import type { MovimientoHistorial, EstadoCaso } from "../../mocks/tipos";

/** Lo que reciben los servicios: repositorios y reloj (inyectables en las pruebas). */
export type Contexto = { repos: Repositorios; reloj: Reloj; aleatorio?: Aleatorio };
export const contextoPorDefecto = (): Contexto => ({ repos: crearRepositorios(), reloj: relojDelSistema });

/** Historial del caso con los nombres de estado (el dominio trabaja con los tipos del maquetado; el repositorio guarda ids, como el diccionario). */
export async function historialDe(repos: Repositorios, idCaso: number): Promise<MovimientoHistorial[]> {
  const estados = await repos.catalogos.estadosCaso();
  return (await repos.historial.deCaso(idCaso)).map((m) => ({ consecutivo: m.consecutivo, fechaHora: m.fechaHora, tipo: m.tipoMovimiento, estado: estados.find((e) => e.idEstadoCaso === m.idEstadoCaso)!.nombre as EstadoCaso, motivo: m.motivo }));
}
export async function idDeEstado(repos: Repositorios, nombre: string): Promise<number> {
  return (await repos.catalogos.estadosCaso()).find((e) => e.nombre === nombre)!.idEstadoCaso;
}
