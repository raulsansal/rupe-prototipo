// Validación del alta de un extravío (HU 011 y 012; R8, R10, R11, R14): todos los errores por campo, con los mismos textos que el maquetado. Funciones puras.
// Solo se leen los campos de la lista permitida: cualquier otro que mande el cliente (idCaso, folio, estado, idUsuario, fechas…) se IGNORA.
import { ID_ALCALDIA_FUERA_DE_LA_CIUDAD, ID_RAZA_OTRA } from "../../config/catalogos";
import { edadValida, type UnidadEdad } from "./edad";
import { validarFotografiaRecibida } from "./fotografia";
import { formatoInvalido } from "../errores";

export { ID_RAZA_OTRA };
export { ID_ALCALDIA_FUERA_DE_LA_CIUDAD }; // solo la asigna el sistema a avistamientos (R14)
export const MOMENTOS = ["madrugada", "mañana", "tarde", "noche", "desconocido"] as const;
export const SEXOS = ["Macho", "Hembra", "No sé"] as const;
export const TAMANOS = ["pequeño", "mediano", "grande"] as const;
export const MAXIMOS = { nombre: 50, color: 50, caracteristicas: 300, razaEspecificada: 50, colonia: 100, calle: 200, referencias: 500, descripcion: 1000 } as const;

export type DatosDeExtravio = {
  nombre: string; sexo: string; idRaza: unknown; razaEspecificada: string; edadValor: unknown; edadUnidad: string; tamano: string; color: string; caracteristicas: string;
  fechaExtravio: string; momento: string; alcaldia: string; colonia: string; calle: string; referencias: string; idMotivo: unknown; descripcion: string;
};
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Toma del cuerpo SOLO los campos conocidos (lista permitida). */
export function leerDatosDeExtravio(cuerpo: unknown): DatosDeExtravio {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "Los datos del registro no son válidos.");
  const c = cuerpo as Record<string, unknown>;
  const edad = typeof c.edad === "object" && c.edad !== null ? (c.edad as Record<string, unknown>) : {};
  return {
    nombre: texto(c.nombre), sexo: texto(c.sexo), idRaza: c.idRaza, razaEspecificada: texto(c.razaEspecificada), edadValor: edad.valor, edadUnidad: texto(edad.unidad), tamano: texto(c.tamano),
    color: texto(c.color), caracteristicas: texto(c.caracteristicas), fechaExtravio: texto(c.fechaExtravio), momento: texto(c.momento), alcaldia: texto(c.alcaldia), colonia: texto(c.colonia),
    calle: texto(c.calle), referencias: texto(c.referencias), idMotivo: c.idMotivo, descripcion: texto(c.descripcion),
  };
}

export type CatalogosDeExtravio = {
  razas: readonly { idRaza: number; estatus: 0 | 1 }[];
  alcaldias: readonly { idAlcaldia: number; nombre: string; estatus: 0 | 1 }[];
  motivos: readonly { idMotivo: number; estatus: 0 | 1 }[];
};

export type ExtravioValidado = {
  perro: { nombre: string; sexo: (typeof SEXOS)[number]; edadValor: number; edadUnidad: UnidadEdad; tamano: (typeof TAMANOS)[number]; color: string; caracteristicasDistintivas?: string; razaEspecificada?: string; idRaza: number };
  caso: { fechaExtravio: string; momentoDelDia: (typeof MOMENTOS)[number]; coloniaZona: string; direccionAproximada?: string; referenciasDelLugar?: string; descripcionCircunstancias?: string; idAlcaldia: number; idMotivo: number };
  foto: { formato: "JPG" | "PNG"; tipoMime: string };
};
export type ResultadoValidacion = { campos: Record<string, string>; validado?: ExtravioValidado };

const entero = (v: unknown): number | undefined => {
  const n = typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) ? n : undefined;
};
const esFechaReal = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f;

export function validarExtravio(d: DatosDeExtravio, cat: CatalogosDeExtravio, { hoy, foto, maximoMb }: { hoy: string; foto: { bytes: Uint8Array; tipoDeclarado: string } | undefined; maximoMb: number }): ResultadoValidacion {
  const e: Record<string, string> = {};
  const largo = (clave: keyof typeof MAXIMOS, valor: string, campo: string) => {
    if (valor.length > MAXIMOS[clave]) e[campo] = `No puede pasar de ${MAXIMOS[clave]} caracteres.`;
  };
  if (!d.nombre) e.nombre = "Escribe el nombre del perro.";
  else if (d.nombre.length > MAXIMOS.nombre) e.nombre = `El nombre no puede pasar de ${MAXIMOS.nombre} caracteres.`;
  if (!(SEXOS as readonly string[]).includes(d.sexo)) e.sexo = "Elige el sexo del perro.";
  const idRaza = entero(d.idRaza);
  const raza = idRaza === undefined ? undefined : cat.razas.find((r) => r.idRaza === idRaza && r.estatus === 1);
  if (!raza) e.raza = "Elige la raza.";
  else if (raza.idRaza === ID_RAZA_OTRA) {
    if (!d.razaEspecificada) e.razaEspecificada = "Especifica la raza.";
    else largo("razaEspecificada", d.razaEspecificada, "razaEspecificada");
  }
  const edadValor = typeof d.edadValor === "string" && /^\d{1,2}$/.test(d.edadValor) ? Number(d.edadValor) : d.edadValor;
  if (!edadValida(edadValor, d.edadUnidad)) e.edad = "Elige la edad aproximada.";
  if (!(TAMANOS as readonly string[]).includes(d.tamano)) e.tamano = "Elige el tamaño.";
  if (!d.color) e.color = "Escribe el color del perro.";
  else largo("color", d.color, "color");
  largo("caracteristicas", d.caracteristicas, "caracteristicas");
  const f = validarFotografiaRecibida(foto, maximoMb);
  if ("error" in f) e.foto = f.error;

  if (!d.fechaExtravio) e.fecha = "Elige la fecha del extravío.";
  else if (!esFechaReal(d.fechaExtravio)) e.fecha = "La fecha del extravío no es válida.";
  else if (d.fechaExtravio > hoy) e.fecha = "La fecha del extravío no puede ser posterior a hoy.";
  if (!(MOMENTOS as readonly string[]).includes(d.momento)) e.momento = "Elige el momento del día.";
  const alcaldia = cat.alcaldias.find((a) => a.nombre === d.alcaldia && a.estatus === 1 && a.idAlcaldia !== ID_ALCALDIA_FUERA_DE_LA_CIUDAD);
  if (!alcaldia) e.alcaldia = "Elige la alcaldía.";
  if (!d.colonia) e.colonia = "Escribe la colonia o zona.";
  else largo("colonia", d.colonia, "colonia");
  largo("calle", d.calle, "calle");
  largo("referencias", d.referencias, "referencias");
  const idMotivo = entero(d.idMotivo);
  const motivo = idMotivo === undefined ? undefined : cat.motivos.find((m) => m.idMotivo === idMotivo && m.estatus === 1);
  if (!motivo) e.motivo = "Elige el motivo del extravío.";
  largo("descripcion", d.descripcion, "descripcion");

  if (Object.keys(e).length) return { campos: e };
  return {
    campos: e,
    validado: {
      perro: {
        nombre: d.nombre, sexo: d.sexo as ExtravioValidado["perro"]["sexo"], edadValor: edadValor as number, edadUnidad: d.edadUnidad as UnidadEdad, tamano: d.tamano as ExtravioValidado["perro"]["tamano"], color: d.color,
        ...(d.caracteristicas ? { caracteristicasDistintivas: d.caracteristicas } : {}), // R8: la raza especificada solo existe con «Otra»; con otra raza se descarta
        ...(raza!.idRaza === ID_RAZA_OTRA ? { razaEspecificada: d.razaEspecificada } : {}), idRaza: raza!.idRaza,
      },
      caso: {
        fechaExtravio: d.fechaExtravio, momentoDelDia: d.momento as ExtravioValidado["caso"]["momentoDelDia"], coloniaZona: d.colonia, ...(d.calle ? { direccionAproximada: d.calle } : {}),
        ...(d.referencias ? { referenciasDelLugar: d.referencias } : {}), ...(d.descripcion ? { descripcionCircunstancias: d.descripcion } : {}), idAlcaldia: alcaldia!.idAlcaldia, idMotivo: motivo!.idMotivo,
      },
      foto: f as { formato: "JPG" | "PNG"; tipoMime: string },
    },
  };
}
