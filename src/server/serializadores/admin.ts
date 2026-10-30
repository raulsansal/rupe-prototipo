// Lo que el ADMINISTRADOR recibe (P6a). Igual que `publico.ts`: listas permitidas campo por campo; nada se copia con `...resto`, para que una columna nueva del almacén no llegue a una respuesta sin
// decidirlo aquí. NUNCA llevan: datos de la persona tutora (nombre, correo, teléfono, id), el token del QR, `vistoPorTutora`, `relevante`, `ubicacionSimulada`, ni la dirección, colonia, referencias
// o coordenadas de un avistamiento. El comentario de un avistamiento SÍ se ve (HU 037). La lista de usuarios es gestión de cuentas: solo lo estrictamente necesario.
import type { Alcaldia, EdadUnidad, EstadoCaso, MomentoDelDia, MovimientoHistorial, Sexo, Tamano } from "../../mocks/tipos";
import type { Rol } from "../../mocks/usuarios";
import type { TipoAccion, Entidad } from "../../mocks/bitacora";

export const CAMPOS_REGISTRO_ADMIN_LISTA = ["folio", "nombre", "fotografiaUrl", "fechaRegistro", "alcaldia", "estado", "puedeDeshabilitar", "puedeRestaurar", "cierre", "moderacion"] as const;
export const CAMPOS_REGISTRO_ADMIN_DETALLE = [
  "folio", "nombre", "sexo", "raza", "razaEspecificada", "edadValor", "edadUnidad", "tamano", "color", "caracteristicasDistintivas", "fotografiaUrl", "fechaRegistro", "fechaExtravio", "alcaldia", "coloniaZona",
  "momentoDelDia", "direccionAproximada", "referenciasDelLugar", "motivo", "descripcionCircunstancias", "estado", "historial", "puedeDeshabilitar", "puedeRestaurar", "cierre", "moderacion",
] as const;
export const CAMPOS_AVISTAMIENTO_ADMIN = ["id", "folio", "fechaHora", "alcaldia", "estadosAnimal", "comentario", "fotografiaUrl", "fallecido", "visible", "motivoModeracion", "fechaModeracion"] as const;
export const CAMPOS_ENTRADA_BITACORA = ["id", "fechaHora", "tipo", "entidad", "idAfectada", "entidadAfectada", "motivo", "detalle", "administrador"] as const;
export const CAMPOS_USUARIO_ADMIN = ["id", "nombreCompleto", "correo", "rol", "activo", "fechaUltimaModificacion", "esLaPersonaActual", "esUltimoAdministradorActivo"] as const;

export const CAMPOS_CATALOGO_ADMIN = ["id", "nombre", "clave", "idCategoria", "categoria", "descripcion", "activo", "protegido", "motivoNoDesactivable"] as const;
export const CAMPOS_PARAMETRO_ADMIN = ["clave", "descripcion", "valor", "valorPorDefecto"] as const;
export const CAMPOS_ESTADO_CASO_ADMIN = ["id", "nombre", "orden"] as const;

// P6c: tablero y reportes (solo agregados: ninguna lista lleva folios, personas, direcciones ni tokens).
export const CAMPOS_TABLERO = ["periodo", "limites", "generadoEn", "casosActivos", "casosLocalizados", "totalCasos", "totalAvistamientos", "promedioLocalizacion", "avistamientosOcultos", "porMotivo", "porEstadoCaso", "cierres", "porEstadoAnimal", "porAlcaldia"] as const;
export const CAMPOS_PERIODO = ["desde", "hasta"] as const;
export const CAMPOS_BARRA = ["id", "nombre", "valor"] as const;
export const CAMPOS_GRUPO_ESTADO_ANIMAL = ["id", "categoria", "barras"] as const;
export const CAMPOS_REPORTE = ["sinDatos", "filtros", "generadoEn", "huella", "totalCasos", "casosLocalizados", "tasaRecuperacion", "avistamientosOcultos", "porMotivo", "porEstadoCaso", "cierres", "porEstadoAnimal", "porAlcaldiaAvistamiento"] as const;
export const CAMPOS_FILTROS_REPORTE = ["desde", "hasta", "alcaldia", "categoria", "estadoCaso"] as const;
export const CAMPOS_OPCION_REPORTE = ["id", "nombre", "activo"] as const;
export const CAMPOS_OPCIONES_REPORTE = ["alcaldias", "categorias", "estadosCaso", "limites"] as const;

const elegir = <T extends object, K extends readonly string[]>(origen: T, campos: K): Record<K[number], unknown> => {
  const salida: Record<string, unknown> = {};
  for (const c of campos) {
    const v = (origen as Record<string, unknown>)[c];
    if (v !== undefined) salida[c] = v;
  }
  return salida as Record<K[number], unknown>;
};

export type CierreDeCaso = "cierre confirmado" | "cancelación" | "deshabilitación";
export type RegistroAdminLista = { folio: string; nombre: string; fotografiaUrl: string; fechaRegistro: string; alcaldia: string; estado: EstadoCaso; puedeDeshabilitar: boolean; puedeRestaurar: boolean; cierre?: CierreDeCaso;
  /** Solo si el caso está cerrado por deshabilitación: el motivo escrito por el Administrador y cuándo. */ moderacion?: { motivo: string; fechaHora: string } };
export type RegistroAdminDetalle = Omit<RegistroAdminLista, "alcaldia"> & {
  /** Nombre del catálogo (las pantallas lo tratan como una alcaldía del catálogo). */ alcaldia: Alcaldia;
  sexo: Sexo; raza: string; razaEspecificada?: string; edadValor: number; edadUnidad: EdadUnidad; tamano: Tamano; color: string; caracteristicasDistintivas?: string; fechaExtravio: string; coloniaZona: string; momentoDelDia: MomentoDelDia;
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

/** P6b: una fila de catálogo para el Administrador. `motivoNoDesactivable` es el texto por el que NO se puede desactivar (valor protegido, última opción activa…), si lo hay. */
export type CatalogoAdmin = { id: number; nombre: string; clave?: string; idCategoria?: number; categoria?: string; descripcion?: string; activo: boolean; protegido: boolean; motivoNoDesactivable?: string };
export type ParametroAdmin = { clave: string; descripcion: string; valor: string; valorPorDefecto: string };
export type EstadoCasoAdmin = { id: number; nombre: string; orden: number };
export const aCatalogoAdmin = (d: CatalogoAdmin): CatalogoAdmin => elegir(d, CAMPOS_CATALOGO_ADMIN) as CatalogoAdmin;
export const aParametroAdmin = (d: ParametroAdmin): ParametroAdmin => elegir(d, CAMPOS_PARAMETRO_ADMIN) as ParametroAdmin;
export const aEstadoCasoAdmin = (d: EstadoCasoAdmin): EstadoCasoAdmin => elegir(d, CAMPOS_ESTADO_CASO_ADMIN) as EstadoCasoAdmin;

export type BarraAdmin = { id?: number; nombre: string; valor: number };
export type GrupoEstadoAnimalAdmin = { id: number; categoria: string; barras: BarraAdmin[] };
export type TableroAdmin = {
  periodo: { desde: string; hasta: string }; limites: { desde: string; hasta: string }; generadoEn: string;
  casosActivos: number; casosLocalizados: number; totalCasos: number; totalAvistamientos: number; promedioLocalizacion: number | null; avistamientosOcultos: number;
  porMotivo: BarraAdmin[]; porEstadoCaso: BarraAdmin[]; cierres: BarraAdmin[]; porEstadoAnimal: GrupoEstadoAnimalAdmin[]; porAlcaldia: BarraAdmin[];
};
export type FiltrosReporteVista = { desde: string; hasta: string; alcaldia: { id: number; nombre: string } | null; categoria: { id: number; nombre: string } | null; estadoCaso: string | null };
export type ReporteAdmin =
  | { sinDatos: true; filtros: FiltrosReporteVista; generadoEn: string }
  | {
      sinDatos: false; filtros: FiltrosReporteVista; generadoEn: string; huella: string; totalCasos: number; casosLocalizados: number; tasaRecuperacion: number | null; avistamientosOcultos: number;
      porMotivo: BarraAdmin[]; porEstadoCaso: BarraAdmin[]; cierres: BarraAdmin[]; porEstadoAnimal: GrupoEstadoAnimalAdmin[]; porAlcaldiaAvistamiento: BarraAdmin[];
    };
export type OpcionesDeReporte = { alcaldias: { id: number; nombre: string; activo: boolean }[]; categorias: { id: number; nombre: string }[]; estadosCaso: string[]; limites: { desde: string; hasta: string } };

const barras = (l: BarraAdmin[]) => l.map((b) => elegir(b, CAMPOS_BARRA) as BarraAdmin);
const grupos = (l: GrupoEstadoAnimalAdmin[]) => l.map((g) => ({ ...(elegir(g, CAMPOS_GRUPO_ESTADO_ANIMAL) as GrupoEstadoAnimalAdmin), barras: barras(g.barras) }));
export const aTableroAdmin = (d: TableroAdmin): TableroAdmin => ({
  ...(elegir(d, CAMPOS_TABLERO) as TableroAdmin), periodo: elegir(d.periodo, CAMPOS_PERIODO) as TableroAdmin["periodo"], limites: elegir(d.limites, CAMPOS_PERIODO) as TableroAdmin["limites"],
  porMotivo: barras(d.porMotivo), porEstadoCaso: barras(d.porEstadoCaso), cierres: barras(d.cierres), porEstadoAnimal: grupos(d.porEstadoAnimal), porAlcaldia: barras(d.porAlcaldia),
});
export const aReporteAdmin = (d: ReporteAdmin): ReporteAdmin => {
  const filtros = {
    ...(elegir(d.filtros, CAMPOS_FILTROS_REPORTE) as FiltrosReporteVista),
    alcaldia: d.filtros.alcaldia && { id: d.filtros.alcaldia.id, nombre: d.filtros.alcaldia.nombre }, categoria: d.filtros.categoria && { id: d.filtros.categoria.id, nombre: d.filtros.categoria.nombre },
  };
  if (d.sinDatos) return { ...(elegir(d, CAMPOS_REPORTE) as ReporteAdmin), filtros } as ReporteAdmin;
  return { ...(elegir(d, CAMPOS_REPORTE) as ReporteAdmin), filtros, porMotivo: barras(d.porMotivo), porEstadoCaso: barras(d.porEstadoCaso), cierres: barras(d.cierres), porEstadoAnimal: grupos(d.porEstadoAnimal), porAlcaldiaAvistamiento: barras(d.porAlcaldiaAvistamiento) } as ReporteAdmin;
};
export const aOpcionesDeReporte = (d: OpcionesDeReporte): OpcionesDeReporte => ({
  ...(elegir(d, CAMPOS_OPCIONES_REPORTE) as OpcionesDeReporte), alcaldias: d.alcaldias.map((x) => elegir(x, CAMPOS_OPCION_REPORTE) as OpcionesDeReporte["alcaldias"][number]),
  categorias: d.categorias.map((x) => ({ id: x.id, nombre: x.nombre })), limites: elegir(d.limites, CAMPOS_PERIODO) as OpcionesDeReporte["limites"],
});
