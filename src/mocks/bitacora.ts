// Bitácora de acciones administrativas (HU 058, tbl_bitacora_accion). Datos ficticios coherentes con 5a y 5b: los mismos usuarios, folios,
// avistamientos y catálogos. Nunca lleva datos de la persona tutora: las entidades se identifican por ID o folio.

export const TIPOS_ACCION = [
  "habilitar usuario",
  "deshabilitar usuario",
  "cambiar rol",
  "deshabilitar caso",
  "restaurar caso",
  "ocultar avistamiento",
  "restaurar avistamiento",
  "modificar parámetro",
  "alta de catálogo",
  "edición de catálogo",
  "desactivación de catálogo",
] as const;
export type TipoAccion = (typeof TIPOS_ACCION)[number];

export type Entidad = "usuario" | "caso" | "avistamiento" | "parámetro" | "catálogo";
/** La entidad afectada se deriva del tipo de acción. */
export const ENTIDAD_DE_TIPO: Record<TipoAccion, Entidad> = {
  "habilitar usuario": "usuario",
  "deshabilitar usuario": "usuario",
  "cambiar rol": "usuario",
  "deshabilitar caso": "caso",
  "restaurar caso": "caso",
  "ocultar avistamiento": "avistamiento",
  "restaurar avistamiento": "avistamiento",
  "modificar parámetro": "parámetro",
  "alta de catálogo": "catálogo",
  "edición de catálogo": "catálogo",
  "desactivación de catálogo": "catálogo",
};
/** El motivo solo existe al deshabilitar un caso y al ocultar un avistamiento (regla 4). */
export const TIPOS_CON_MOTIVO: readonly TipoAccion[] = ["deshabilitar caso", "ocultar avistamiento"];
/** El detalle solo existe en cambios de rol, de parámetros y de catálogos: «anterior → nuevo», o solo el nombre del valor nuevo en un alta. */
export const TIPOS_CON_DETALLE: readonly TipoAccion[] = ["cambiar rol", "modificar parámetro", "alta de catálogo", "edición de catálogo", "desactivación de catálogo"];

export type AccionBitacora = {
  id: number;
  /** ISO 8601, UTC. */
  fechaHora: string;
  tipo: TipoAccion;
  /** Derivada del tipo. */
  entidad: Entidad;
  idEntidad: string;
  motivo?: string;
  detalle?: string;
  administrador: string;
};

const RICARDO = "Ricardo Vega Ficticio";
const CARMEN = "Carmen Ortiz Ejemplo";

type Semilla = Omit<AccionBitacora, "id" | "entidad">;
const SEMILLAS: Semilla[] = [
  { fechaHora: "2026-10-18T10:25:00Z", tipo: "restaurar avistamiento", idEntidad: "201", administrador: RICARDO },
  { fechaHora: "2026-10-17T14:10:00Z", tipo: "ocultar avistamiento", idEntidad: "201", motivo: "La fotografía mostraba el rostro de una persona.", administrador: RICARDO },
  { fechaHora: "2026-10-16T18:20:00Z", tipo: "desactivación de catálogo", idEntidad: "Motivos · 2", detalle: "Activo → Inactivo", administrador: RICARDO },
  { fechaHora: "2026-10-15T16:05:00Z", tipo: "modificar parámetro", idEntidad: "expiracion_token_minutos", detalle: "45 → 60", administrador: RICARDO },
  { fechaHora: "2026-10-14T17:40:00Z", tipo: "desactivación de catálogo", idEntidad: "Estados del animal · 16", detalle: "Activo → Inactivo", administrador: RICARDO },
  { fechaHora: "2026-10-14T17:35:00Z", tipo: "desactivación de catálogo", idEntidad: "Estados del animal · 17", detalle: "Activo → Inactivo", administrador: RICARDO },
  { fechaHora: "2026-10-13T20:05:00Z", tipo: "deshabilitar caso", idEntidad: "RUPE-D5W2QK8X", motivo: "La fotografía no corresponde a un perro extraviado: es una imagen tomada de internet.", administrador: RICARDO },
  { fechaHora: "2026-10-13T11:15:00Z", tipo: "ocultar avistamiento", idEntidad: "303", motivo: "La fotografía no corresponde a un perro.", administrador: RICARDO },
  { fechaHora: "2026-10-12T15:30:00Z", tipo: "alta de catálogo", idEntidad: "Motivos · 13", detalle: "Escape durante traslado o servicio de terceros", administrador: RICARDO },
  { fechaHora: "2026-10-10T19:10:00Z", tipo: "desactivación de catálogo", idEntidad: "Razas · 6", detalle: "Activo → Inactivo", administrador: RICARDO },
  { fechaHora: "2026-10-09T17:30:00Z", tipo: "ocultar avistamiento", idEntidad: "105", motivo: "El comentario incluía un número telefónico de una persona ajena al caso.", administrador: RICARDO },
  { fechaHora: "2026-10-08T14:25:00Z", tipo: "desactivación de catálogo", idEntidad: "Alcaldías · 12", detalle: "Activa → Inactiva", administrador: RICARDO },
  { fechaHora: "2026-10-06T16:00:00Z", tipo: "modificar parámetro", idEntidad: "tamano_maximo_archivo_mb", detalle: "3 → 4", administrador: RICARDO },
  { fechaHora: "2026-09-30T18:05:00Z", tipo: "deshabilitar usuario", idEntidad: "3", administrador: RICARDO },
  { fechaHora: "2026-09-28T10:15:00Z", tipo: "restaurar caso", idEntidad: "RUPE-C2J9RK6Z", administrador: RICARDO },
  { fechaHora: "2026-09-27T20:20:00Z", tipo: "deshabilitar caso", idEntidad: "RUPE-C2J9RK6Z", motivo: "La fotografía requería verificación.", administrador: RICARDO },
  { fechaHora: "2026-09-18T16:30:00Z", tipo: "habilitar usuario", idEntidad: "3", administrador: RICARDO },
  { fechaHora: "2026-09-12T17:00:00Z", tipo: "deshabilitar usuario", idEntidad: "8", administrador: RICARDO },
  { fechaHora: "2026-09-05T13:10:00Z", tipo: "deshabilitar usuario", idEntidad: "3", administrador: RICARDO },
  { fechaHora: "2026-08-21T15:30:00Z", tipo: "deshabilitar usuario", idEntidad: "4", administrador: RICARDO },
  { fechaHora: "2026-08-19T19:00:00Z", tipo: "modificar parámetro", idEntidad: "version_aviso_privacidad", detalle: "0.9 → 1.0", administrador: CARMEN },
  { fechaHora: "2026-08-02T19:00:00Z", tipo: "alta de catálogo", idEntidad: "Motivos · 12", detalle: "Sustracción o robo", administrador: CARMEN },
  { fechaHora: "2026-07-14T16:45:00Z", tipo: "cambiar rol", idEntidad: "4", detalle: "Tutor → Administrador", administrador: RICARDO },
  { fechaHora: "2026-07-01T15:20:00Z", tipo: "habilitar usuario", idEntidad: "8", administrador: RICARDO },
  { fechaHora: "2026-06-18T17:55:00Z", tipo: "edición de catálogo", idEntidad: "Estados del animal · 10", detalle: "Nombre: En albergue → En albergue / Centro de control", administrador: RICARDO },
];

/** Del más reciente al más antiguo; el ID crece con la fecha. */
export const BITACORA: readonly AccionBitacora[] = [...SEMILLAS]
  .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  .map((s, i): AccionBitacora => ({ ...s, id: i + 1, entidad: ENTIDAD_DE_TIPO[s.tipo] }))
  .reverse();

export const FECHA_PRIMERA_ACCION = "2026-06-18";
