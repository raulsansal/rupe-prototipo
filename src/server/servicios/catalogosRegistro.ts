import "server-only";
// P6b: lo que el formulario de REGISTRO de un extravío ofrece. Solo valores ACTIVOS del catálogo (alcaldía, raza, motivo), de la misma fuente que valida el alta (`validarExtravio`), y el tamaño máximo de
// la fotografía del parámetro. La guarda de Tutor va aquí dentro (R32), no en el layout. «Fuera de la Ciudad de México» no se ofrece al registrar.
import { ID_ALCALDIA_FUERA_DE_LA_CIUDAD } from "../../config/catalogos";
import { LIMITE_TECNICO_MB } from "../../config/parametros";
import { exigirRol, type SesionActual } from "../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "./contexto";

export type OpcionesDeRegistro = {
  alcaldias: { id: number; nombre: string }[];
  razas: { id: number; nombre: string }[];
  categoriasMotivo: { id: number; nombre: string }[];
  motivos: { id: number; idCategoria: number; nombre: string; descripcion: string }[];
  maximoMb: number;
};

export async function opcionesDeRegistro(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<OpcionesDeRegistro> {
  exigirRol(sesion, "Tutor");
  const { catalogos, parametros } = ctx.repos;
  return {
    alcaldias: (await catalogos.alcaldias()).filter((a) => a.estatus === 1 && a.idAlcaldia !== ID_ALCALDIA_FUERA_DE_LA_CIUDAD).map((a) => ({ id: a.idAlcaldia, nombre: a.nombre })),
    razas: (await catalogos.razas()).filter((r) => r.estatus === 1).map((r) => ({ id: r.idRaza, nombre: r.nombre })),
    categoriasMotivo: (await catalogos.categoriasMotivo()).map((c) => ({ id: c.idCategoriaMotivo, nombre: c.nombre })),
    motivos: (await catalogos.motivos()).filter((m) => m.estatus === 1).map((m) => ({ id: m.idMotivo, idCategoria: m.idCategoriaMotivo, nombre: m.nombre, descripcion: m.descripcion })),
    maximoMb: Math.min(Number(await parametros.valor("tamano_maximo_archivo_mb")), LIMITE_TECNICO_MB),
  };
}

/** O3 (aprobada solo para el filtro de avistamientos de la persona tutora): TODAS las alcaldías del almacén, activas e inactivas, porque filtra avistamientos ya reportados en cualquiera de ellas. */
export async function alcaldiasParaFiltrar(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<{ id: number; nombre: string }[]> {
  exigirRol(sesion, "Tutor");
  return (await ctx.repos.catalogos.alcaldias()).sort((a, b) => a.idAlcaldia - b.idAlcaldia).map((a) => ({ id: a.idAlcaldia, nombre: a.nombre }));
}
