// Serializadores de visibilidad (D6 = columnas P vs R del diccionario). Lo que sale por las funciones y rutas PÚBLICAS se arma campo por campo con una
// lista permitida (nunca copiando el registro entero): así una columna reservada nueva no se filtra por descuido. Nunca llevan datos de la persona tutora.
import type { FichaPublica, Folio } from "../../mocks/tipos";
import type { CasoExtravio, Fotografia, Perro } from "../tipos";

/** Columnas P de la ficha pública, en el orden del tipo FichaPublica del maquetado. */
export const CAMPOS_FICHA_PUBLICA = ["nombre", "sexo", "raza", "edadValor", "edadUnidad", "tamano", "color", "caracteristicasDistintivas", "fotografiaUrl", "fechaExtravio", "alcaldia", "coloniaZona", "folio", "estado"] as const satisfies readonly (keyof FichaPublica)[];
export const CAMPOS_CONSULTA_ESTATUS = ["folio", "estado", "fechaCambioEstado"] as const;
export const CAMPOS_CONFIRMACION_AVISTAMIENTO = ["folio", "fechaHoraEnvio"] as const;
export const CAMPOS_CONFIRMACION_REPORTE = ["id", "folio", "fechaHoraEnvio"] as const;

export type NombresDeCatalogo = { raza: string; alcaldia: FichaPublica["alcaldia"]; estado: FichaPublica["estado"] };

/** Las fotos subidas se guardan tras una ruta con guarda de dueño (/api/fotografias/<id>): la ficha pública NUNCA expone esa ruta; usa la ruta pública de la foto del caso (HU 024, P4). */
const esFotoPrivada = (ref: string) => ref.startsWith("/api/fotografias/");

/** Ficha pública: solo columnas P. Con la raza «Otra» se muestra la raza especificada (también P). */
export function aFichaPublica(caso: CasoExtravio, perro: Perro, foto: Fotografia, nombres: NombresDeCatalogo): FichaPublica {
  const ficha: FichaPublica = {
    nombre: perro.nombre, sexo: perro.sexo, raza: perro.razaEspecificada ?? nombres.raza, edadValor: perro.edadValor, edadUnidad: perro.edadUnidad, tamano: perro.tamano, color: perro.color,
    fotografiaUrl: esFotoPrivada(foto.referenciaArchivo) ? `/api/fichas/${caso.folio}/fotografia` : foto.referenciaArchivo, fechaExtravio: caso.fechaExtravio, alcaldia: nombres.alcaldia, coloniaZona: caso.coloniaZona, folio: caso.folio as Folio, estado: nombres.estado,
  };
  if (perro.caracteristicasDistintivas) ficha.caracteristicasDistintivas = perro.caracteristicasDistintivas;
  return ficha;
}

/** Consulta de estatus por folio (HU 038): estatus y fecha del último cambio, sin datos de la persona tutora. */
export const aConsultaEstatus = (folio: string, estado: FichaPublica["estado"], fechaCambioEstado: string) => ({ folio, estado, fechaCambioEstado });

/** Lo único que recibe quien reporta un avistamiento: el folio y cuándo se recibió. Todas las columnas del avistamiento son reservadas. */
export const aConfirmacionAvistamiento = (folio: string, fechaHoraEnvio: string) => ({ folio, fechaHoraEnvio });

/** Confirmación de un reporte (HU 035): el ID del avistamiento, el folio y cuándo se recibió. Nunca el token, la ubicación ni nada de la persona tutora. */
export const aConfirmacionDeReporte = (id: number, folio: string, fechaHoraEnvio: string) => ({ id, folio, fechaHoraEnvio });
