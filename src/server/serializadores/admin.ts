// Lo que el ADMINISTRADOR recibe (P6a). Igual que `publico.ts`: listas permitidas campo por campo; nada se copia con `...resto`, para que una columna nueva del almacén no llegue a una respuesta sin
// decidirlo aquí. NUNCA llevan: datos de la persona tutora (nombre, correo, teléfono, id), el token del QR, `vistoPorTutora`, `relevante`, `ubicacionSimulada`, ni la dirección, colonia, referencias
// o coordenadas de un avistamiento. El comentario de un avistamiento SÍ se ve (HU 037). La lista de usuarios es gestión de cuentas: solo lo estrictamente necesario.
import type { EstadoCaso, MovimientoHistorial } from "../../mocks/tipos";
import type { Rol } from "../../mocks/usuarios";
import type { TipoAccion, Entidad } from "../../mocks/bitacora";

export const CAMPOS_REGISTRO_ADMIN_LISTA = ["folio", "nombre", "fotografiaUrl", "fechaRegistro", "alcaldia", "estado", "puedeDeshabilitar", "puedeRestaurar", "cierre"] as const;
export const CAMPOS_REGISTRO_ADMIN_DETALLE = [
  "folio", "nombre", "sexo", "raza", "razaEspecificada", "edadValor", "edadUnidad", "tamano", "color", "caracteristicasDistintivas", "fotografiaUrl", "fechaRegistro", "fechaExtravio", "alcaldia", "coloniaZona",
  "momentoDelDia", "direccionAproximada", "referenciasDelLugar", "motivo", "descripcionCircunstancias", "estado", "historial", "puedeDeshabilitar", "puedeRestaurar", "cierre",
] as const;
export const CAMPOS_AVISTAMIENTO_ADMIN = ["id", "folio", "fechaHora", "alcaldia", "estadosAnimal", "comentario", "fotografiaUrl", "fallecido", "visible", "motivoModeracion", "fechaModeracion"] as const;
export const CAMPOS_ENTRADA_BITACORA = ["id", "fechaHora", "tipo", "entidad", "idAfectada", "entidadAfectada", "motivo", "detalle", "administrador"] as const;
export const CAMPOS_USUARIO_ADMIN = ["id", "nombreCompleto", "correo", "rol", "activo", "fechaUltimaModificacion", "esLaPersonaActual", "esUltimoAdministradorActivo"] as const;

const elegir = <T extends object, K extends readonly string[]>(origen: T, campos: K): Record<K[number], unknown> => {
  const salida: Record<string, unknown> = {};
  for (const c of campos) {
    const v = (origen as Record<string, unknown>)[c];
    if (v !== undefined) salida[c] = v;
  }
  return salida as Record<K[number], unknown>;
};

export type CierreDeCaso = "cierre confirmado" | "cancelación" | "deshabilitación";
export type RegistroAdminLista = { folio: string; nombre: string; fotografiaUrl: string; fechaRegistro: string; alcaldia: string; estado: EstadoCaso; puedeDeshabilitar: boolean; puedeRestaurar: boolean; cierre?: CierreDeCaso };
export type RegistroAdminDetalle = RegistroAdminLista & {
  sexo: string; raza: string; razaEspecificada?: string; edadValor: number; edadUnidad: string; tamano: string; color: string; caracteristicasDistintivas?: string; fechaExtravio: string; coloniaZona: string; momentoDelDia: string;
  /** Reservados del extravío: solo en el detalle (HU 016). */
  direccionAproximada?: string; referenciasDelLugar?: string; motivo: string; descripcionCircunstancias?: string; historial: MovimientoHistorial[];
};
export type AvistamientoAdmin = { id: number; folio: string; fechaHora: string; alcaldia: string; estadosAnimal: string[]; comentario?: string; fotografiaUrl?: string; fallecido: boolean; visible: boolean; motivoModeracion?: string; fechaModeracion?: string };
export type EntradaBitacoraVista = { id: number; fechaHora: string; tipo: TipoAccion; entidad: Entidad; idAfectada: string; entidadAfectada: string; motivo?: string; detalle?: string; administrador: string };
export type UsuarioAdmin = { id: number; nombreCompleto: string; correo: string; rol: Rol; activo: boolean; fechaUltimaModificacion: string; esLaPersonaActual: boolean; esUltimoAdministradorActivo: boolean };

export const aRegistroAdminLista = (d: RegistroAdminLista): RegistroAdminLista => elegir(d, CAMPOS_REGISTRO_ADMIN_LISTA) as RegistroAdminLista;
export const aRegistroAdminDetalle = (d: RegistroAdminDetalle): RegistroAdminDetalle => ({ ...(elegir(d, CAMPOS_REGISTRO_ADMIN_DETALLE) as RegistroAdminDetalle), historial: d.historial.map((m) => elegir(m, ["consecutivo", "fechaHora", "tipo", "estado", "motivo"] as const) as unknown as MovimientoHistorial) });
export const aAvistamientoAdmin = (d: AvistamientoAdmin): AvistamientoAdmin => elegir(d, CAMPOS_AVISTAMIENTO_ADMIN) as AvistamientoAdmin;
export const aEntradaBitacora = (d: EntradaBitacoraVista): EntradaBitacoraVista => elegir(d, CAMPOS_ENTRADA_BITACORA) as EntradaBitacoraVista;
export const aUsuarioAdmin = (d: UsuarioAdmin): UsuarioAdmin => elegir(d, CAMPOS_USUARIO_ADMIN) as UsuarioAdmin;
