import "server-only";
// Adaptadores de los cuatro catálogos del almacén en memoria a la vista común `FilaCatalogo` del dominio (P6b). Cada uno sabe leer sus filas, crear una y aplicar los campos editados; las
// reglas viven en `dominio/catalogos.ts`. SÍNCRONOS: se usan dentro de `transaccion`.
import type { TipoCatalogo } from "../../config/catalogos";
import type { CategoriaDeCatalogo, DatosCatalogo, FilaCatalogo } from "../dominio/catalogos";
import type { Almacen } from "./almacen";
import { siguienteId } from "./almacen";

type Adaptador = {
  filas(al: Almacen): FilaCatalogo[];
  categorias(al: Almacen): CategoriaDeCatalogo[];
  crear(al: Almacen, d: DatosCatalogo): void;
  aplicar(al: Almacen, f: FilaCatalogo): void;
};

export const ADAPTADORES: Record<TipoCatalogo, Adaptador> = {
  alcaldias: {
    filas: (al) => al.alcaldias.map((x) => ({ id: x.idAlcaldia, nombre: x.nombre, clave: x.claveGeoestadistica, activo: x.estatus === 1 })),
    categorias: () => [],
    crear: (al, d) => void al.alcaldias.push({ idAlcaldia: siguienteId(al, "alcaldia"), nombre: d.nombre, claveGeoestadistica: d.clave!, estatus: 1 }),
    aplicar: (al, f) => Object.assign(al.alcaldias.find((x) => x.idAlcaldia === f.id)!, { nombre: f.nombre, claveGeoestadistica: f.clave, estatus: f.activo ? 1 : 0 }),
  },
  razas: {
    filas: (al) => al.razas.map((x) => ({ id: x.idRaza, nombre: x.nombre, clave: null, activo: x.estatus === 1 })),
    categorias: () => [],
    crear: (al, d) => void al.razas.push({ idRaza: siguienteId(al, "raza"), nombre: d.nombre, estatus: 1 }),
    aplicar: (al, f) => Object.assign(al.razas.find((x) => x.idRaza === f.id)!, { nombre: f.nombre, estatus: f.activo ? 1 : 0 }),
  },
  motivos: {
    filas: (al) => al.motivos.map((x) => ({ id: x.idMotivo, nombre: x.nombre, clave: null, idCategoria: x.idCategoriaMotivo, descripcion: x.descripcion, activo: x.estatus === 1 })),
    categorias: (al) => al.categoriasMotivo.map((c) => ({ id: c.idCategoriaMotivo, nombre: c.nombre })),
    crear: (al, d) => void al.motivos.push({ idMotivo: siguienteId(al, "motivo"), idCategoriaMotivo: d.idCategoria!, nombre: d.nombre, descripcion: d.descripcion!, estatus: 1 }),
    aplicar: (al, f) => Object.assign(al.motivos.find((x) => x.idMotivo === f.id)!, { nombre: f.nombre, idCategoriaMotivo: f.idCategoria, descripcion: f.descripcion, estatus: f.activo ? 1 : 0 }),
  },
  "estados-animal": {
    filas: (al) => al.estadosAnimal.map((x) => ({ id: x.idEstadoAnimal, nombre: x.nombre, clave: null, idCategoria: x.idCategoriaEstadoAnimal, descripcion: x.descripcion, activo: x.estatus === 1 })),
    categorias: (al) => al.categoriasEstadoAnimal.map((c) => ({ id: c.idCategoriaEstadoAnimal, nombre: c.nombre })),
    crear: (al, d) => void al.estadosAnimal.push({ idEstadoAnimal: siguienteId(al, "estado_animal"), idCategoriaEstadoAnimal: d.idCategoria!, nombre: d.nombre, descripcion: d.descripcion!, estatus: 1 }),
    aplicar: (al, f) => Object.assign(al.estadosAnimal.find((x) => x.idEstadoAnimal === f.id)!, { nombre: f.nombre, idCategoriaEstadoAnimal: f.idCategoria, descripcion: f.descripcion, estatus: f.activo ? 1 : 0 }),
  },
};
