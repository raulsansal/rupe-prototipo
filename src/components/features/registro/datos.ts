import { ID_RAZA_OTRA } from "@/mocks/catalogos";
import type { Alcaldia, MomentoDelDia, Sexo, Tamano } from "@/mocks/tipos";

export const PASOS_REGISTRO = ["Datos del perro", "Circunstancias"];
export const TITULOS_REGISTRO = ["Datos del perro", "Circunstancias del extravío"];

/** Lo que se va capturando; vive solo en memoria mientras dura el flujo. */
export type DatosRegistro = {
  nombre: string;
  sexo: Sexo | "";
  razaId: string;
  razaEspecificada: string;
  edadValor: string;
  edadUnidad: "meses" | "años";
  tamano: Tamano | "";
  color: string;
  caracteristicas: string;
  fotoUrl?: string;
  /** La fotografía YA reducida por el navegador (es lo que se envía); fotoUrl es solo su vista previa. */
  foto?: Blob;
  fechaExtravio: string;
  momento: MomentoDelDia | "";
  alcaldia: Alcaldia | "";
  calle: string;
  colonia: string;
  referencias: string;
  motivoId: string;
  descripcion: string;
};

export const REGISTRO_VACIO: DatosRegistro = {
  nombre: "",
  sexo: "",
  razaId: "",
  razaEspecificada: "",
  edadValor: "",
  edadUnidad: "años",
  tamano: "",
  color: "",
  caracteristicas: "",
  fechaExtravio: "",
  momento: "",
  alcaldia: "",
  calle: "",
  colonia: "",
  referencias: "",
  motivoId: "",
  descripcion: "",
};

/** Longitudes máximas del diccionario (tbl_perro y tbl_caso_extravio). */
export const MAXIMOS = { nombre: 50, color: 50, caracteristicas: 300, razaEspecificada: 50, calle: 200, colonia: 100, referencias: 500, descripcion: 1000 } as const;

export type ErroresRegistro = Partial<Record<"nombre" | "sexo" | "raza" | "razaEspecificada" | "edad" | "tamano" | "color" | "foto" | "fecha" | "momento" | "alcaldia" | "colonia" | "motivo", string>>;

export const esRazaOtra = (d: DatosRegistro) => d.razaId === String(ID_RAZA_OTRA);

/** Valores de edad permitidos (CHECK del diccionario): meses de 0 a 11 y años de 1 a 50. */
export function opcionesEdad(unidad: DatosRegistro["edadUnidad"]) {
  if (unidad === "meses") return Array.from({ length: 12 }, (_, i) => ({ valor: String(i), etiqueta: i === 0 ? "Menos de 1 mes" : i === 1 ? "1 mes" : `${i} meses` }));
  return Array.from({ length: 50 }, (_, i) => ({ valor: String(i + 1), etiqueta: i === 0 ? "1 año" : `${i + 1} años` }));
}

export function validarRegistro(paso: 1 | 2, d: DatosRegistro, hoy: string): ErroresRegistro {
  const e: ErroresRegistro = {};
  if (paso === 1) {
    if (!d.nombre.trim()) e.nombre = "Escribe el nombre del perro.";
    if (!d.sexo) e.sexo = "Elige el sexo del perro.";
    if (!d.razaId) e.raza = "Elige la raza.";
    else if (esRazaOtra(d) && !d.razaEspecificada.trim()) e.razaEspecificada = "Especifica la raza.";
    if (d.edadValor === "") e.edad = "Elige la edad aproximada.";
    if (!d.tamano) e.tamano = "Elige el tamaño.";
    if (!d.color.trim()) e.color = "Escribe el color del perro.";
    if (!d.fotoUrl) e.foto = "La fotografía es obligatoria. Toma o elige una foto de tu perro.";
  } else {
    if (!d.fechaExtravio) e.fecha = "Elige la fecha del extravío.";
    else if (d.fechaExtravio > hoy) e.fecha = "La fecha del extravío no puede ser posterior a hoy.";
    if (!d.momento) e.momento = "Elige el momento del día.";
    if (!d.alcaldia) e.alcaldia = "Elige la alcaldía.";
    if (!d.colonia.trim()) e.colonia = "Escribe la colonia o zona.";
    if (!d.motivoId) e.motivo = "Elige el motivo del extravío.";
  }
  return e;
}
