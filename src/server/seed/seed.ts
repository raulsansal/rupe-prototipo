import "server-only";
// Datos ficticios iniciales del Prototipo, derivados de src/mocks/ (mismos folios, usuarios, catálogos, avistamientos y bitácora que el maquetado).
// Todo es ficticio. Las contraseñas de las 3 cuentas salen SOLO de variables de entorno (ver .env.example); sin ellas la cuenta existe sin credencial.
//
// PENDIENTE (P6): hoy el tablero (ADM-01) y Reportes (ADM-02) se calculan solo con los casos y avistamientos SINTÉTICOS de src/mocks/tablero.ts, y
// sus cifras no deben cambiar. En P6 deberán SUMAR a ellos los casos y avistamientos reales de este almacén (los sembrados aquí ya están en el
// maquetado de moderación pero no en esas cifras), sin cambiar hoy ninguna cifra.
import { join } from "node:path";
import { hashSync } from "bcryptjs";
import { COSTO_BCRYPT } from "../sesion/contrasenas";
import { leerFotoSembrada } from "./fotosSembradas";
import { CASOS_ORIGEN } from "../../mocks/casos";
import { CATEGORIAS_ESTADO_ANIMAL, CATEGORIAS_MOTIVO, CLAVES_GEOESTADISTICAS, ESTADOS_ANIMAL, MOTIVOS, RAZAS } from "../../mocks/catalogos";
import { AVISTAMIENTOS } from "../../mocks/avistamientos";
import { BITACORA } from "../../mocks/bitacora";
import { AVISTAMIENTOS_OCULTOS_ORIGEN, CASOS_MODERACION } from "../../mocks/moderacion";
import { ALCALDIAS, ESTADOS_CASO, FUERA_DE_LA_CIUDAD } from "../../mocks/tipos";
import { USUARIOS_INICIALES } from "../../mocks/usuarios";
import type { Almacen } from "../memoria/almacen";
import { siguienteId } from "../memoria/almacen";
import type * as T from "../tipos";

const ID_ADMIN = 1; // Ricardo Vega Ficticio
const ID_TUTOR_1 = 2; // Rosa Hernández Ficticia: dueña de los casos de CASOS_ORIGEN
const ID_TUTOR_2 = 5; // Luis Navarro Ficticio: dueño de los casos extra de moderación
const FECHA_REGISTRO_USUARIOS = "2026-05-15T12:00:00Z";

type Entorno = Record<string, string | undefined>;
/** Cuentas con credencial: nombres de las variables de entorno (no sus valores). */
export const CUENTAS_CON_CREDENCIAL = [
  { idUsuario: ID_ADMIN, variableCorreo: "RUPE_ADMIN_CORREO", variableContrasena: "RUPE_ADMIN_CONTRASENA" },
  { idUsuario: ID_TUTOR_1, variableCorreo: "RUPE_TUTOR1_CORREO", variableContrasena: "RUPE_TUTOR1_CONTRASENA" },
  { idUsuario: ID_TUTOR_2, variableCorreo: "RUPE_TUTOR2_CORREO", variableContrasena: "RUPE_TUTOR2_CONTRASENA" },
] as const;

const idPorNombre = <X extends { nombre: string }>(lista: readonly X[], nombre: string, id: (x: X) => number, que: string): number => {
  const x = lista.find((e) => e.nombre === nombre);
  if (!x) throw new Error(`Seed: ${que} «${nombre}» no está en el catálogo`);
  return id(x);
};

/** Los mocks usan nombres cortos de raza («Labrador»); se busca el del catálogo y, si no hay, es «Otra» con la raza especificada (R8). */
function razaDe(nombre: string, razas: readonly T.Raza[]): { idRaza: number; razaEspecificada?: string } {
  const n = nombre.toLowerCase();
  const r = razas.find((x) => x.nombre.toLowerCase() === n) ?? razas.find((x) => x.nombre.toLowerCase().startsWith(n));
  return r ? { idRaza: r.idRaza } : { idRaza: razas.find((x) => x.nombre === "Otra")!.idRaza, razaEspecificada: nombre };
}

const AUTOMATICOS = new Set(["registro", "ficha generada", "avistamiento recibido", "avistamiento revisado"]);
const ETIQUETA_CATALOGO: Record<string, string> = { Alcaldías: "alcaldia", Razas: "raza", Motivos: "motivo", "Estados del animal": "estado_animal" };
/** Token de los mocks (el mismo de src/mocks/casos.ts): así el QR de cada caso sigue coincidiendo con los enlaces del maquetado. */
const tokenDeMaqueta = (folio: string) => `MAQUETA${folio.slice(5)}`.padEnd(32, "0");

/** `carpetaFotos`: carpeta con `<FOLIO>.jpg` de los casos sembrados (P2c). Sin ella (pruebas, CI) todas las fotos son el marcador. */
export type OpcionesSiembra = { carpetaFotos?: string };

export function sembrar(a: Almacen, entorno: Entorno = process.env, { carpetaFotos }: OpcionesSiembra = {}): Almacen {
  // ---- Catálogos ----
  // PROTOTIPO: todos los valores sembrados quedan ACTIVOS para que
  // los flujos de prueba no fallen con alcaldía Milpa Alta, raza Pug, motivo «Estrés…» ni los estados del animal 16 y 17. Lo desactivado se prueba con acciones reales del Administrador (P6b).
  // El seed resuelve alcaldía, raza y motivo de los casos POR EL NOMBRE de los mocks (nunca por los del almacén ya editado: se siembra siempre desde cero).
  [...ALCALDIAS, FUERA_DE_LA_CIUDAD].forEach((nombre, i) => a.alcaldias.push({ idAlcaldia: nombre === FUERA_DE_LA_CIUDAD ? 17 : i + 1, nombre, claveGeoestadistica: CLAVES_GEOESTADISTICAS[nombre] ?? null, estatus: 1 }));
  RAZAS.forEach((e) => a.razas.push({ idRaza: e.id, nombre: e.nombre, estatus: 1 }));
  CATEGORIAS_MOTIVO.forEach((c) => a.categoriasMotivo.push({ idCategoriaMotivo: c.id, nombre: c.nombre }));
  MOTIVOS.forEach((e) => a.motivos.push({ idMotivo: e.id, idCategoriaMotivo: e.idCategoria, nombre: e.nombre, descripcion: e.descripcion, estatus: 1 }));
  CATEGORIAS_ESTADO_ANIMAL.forEach((c) => a.categoriasEstadoAnimal.push({ idCategoriaEstadoAnimal: c.id, nombre: c.nombre }));
  ESTADOS_ANIMAL.forEach((e) => a.estadosAnimal.push({ idEstadoAnimal: e.id, idCategoriaEstadoAnimal: e.idCategoria, nombre: e.nombre, descripcion: e.descripcion, estatus: 1 }));
  // P6b: las altas del Administrador toman el siguiente id (AUTO_INCREMENT): el contador de cada catálogo parte del máximo sembrado.
  a.ids.alcaldia = Math.max(0, ...a.alcaldias.map((x) => x.idAlcaldia));
  a.ids.raza = Math.max(0, ...a.razas.map((x) => x.idRaza));
  a.ids.motivo = Math.max(0, ...a.motivos.map((x) => x.idMotivo));
  a.ids.estado_animal = Math.max(0, ...a.estadosAnimal.map((x) => x.idEstadoAnimal));
  ESTADOS_CASO.forEach((nombre, i) => a.estadosCaso.push({ idEstadoCaso: i + 1, nombre, orden: i + 1 }));
  a.parametros.push(
    { clave: "version_aviso_privacidad", descripcion: "Versión vigente del aviso de privacidad", valor: "1.0", valorPorDefecto: "1.0" },
    { clave: "expiracion_token_minutos", descripcion: "Minutos de vigencia del token de recuperación", valor: "60", valorPorDefecto: "60" },
    { clave: "tamano_maximo_archivo_mb", descripcion: "Tamaño máximo de archivo permitido, en MB", valor: "4", valorPorDefecto: "4" },
  );
  const idEstado = (n: string) => idPorNombre(a.estadosCaso, n, (e) => e.idEstadoCaso, "estado del caso");

  // ---- Usuarios ----
  for (const u of USUARIOS_INICIALES) {
    const cuenta = CUENTAS_CON_CREDENCIAL.find((c) => c.idUsuario === u.id);
    const contrasena = cuenta ? entorno[cuenta.variableContrasena] : undefined;
    a.usuarios.push({
      idUsuario: u.id, nombreCompleto: u.nombreCompleto, correo: (cuenta && entorno[cuenta.variableCorreo]) || u.correo,
      contrasenaHash: contrasena ? hashSync(contrasena, COSTO_BCRYPT) : null,
      telefono: u.id === ID_TUTOR_1 ? CASOS_ORIGEN[0].tutor.telefono.replace(/\D/g, "") : `5555000${String(u.id).padStart(3, "0")}`,
      estatus: u.activo ? 1 : 0, fechaRegistro: FECHA_REGISTRO_USUARIOS, fechaUltimaModificacion: u.fechaUltimaModificacion,
      intentosFallidos: 0, bloqueadoHasta: null, notificacionesActivas: true, rol: u.rol,
    });
    a.ids.usuario = Math.max(a.ids.usuario ?? 0, u.id);
    // R5: todo usuario tiene al menos una aceptación del aviso (versión vigente al registrarse).
    a.aceptaciones.push({ idAceptacionAviso: siguienteId(a, "aceptacion"), versionAviso: "1.0", fechaHora: FECHA_REGISTRO_USUARIOS, idUsuario: u.id });
  }
  const usuarioPorNombre = (n: string) => a.usuarios.find((u) => u.nombreCompleto === n)!.idUsuario;

  // ---- Casos, perros, fotografías, historial y QR (en orden cronológico: el id crece con la fecha de registro) ----
  const origenPorFolio = new Map(CASOS_ORIGEN.map((c) => [c.folio, c]));
  const casos = [...CASOS_MODERACION].sort((x, y) => x.fechaRegistro.localeCompare(y.fechaRegistro));
  for (const c of casos) {
    const origen = origenPorFolio.get(c.folio);
    const idDueno = origen ? ID_TUTOR_1 : ID_TUTOR_2;
    const foto: T.Fotografia = { idFotografia: siguienteId(a, "fotografia"), referenciaArchivo: c.fotografiaUrl, formato: "JPG", tamanoBytes: 120_000, fechaCarga: c.fechaRegistro };
    const real = carpetaFotos ? leerFotoSembrada(carpetaFotos, c.folio) : undefined;
    if (real) {
      // Foto real del caso: se sirve por la ruta con guarda (dueña o Administrador), como las que sube la persona tutora.
      foto.referenciaArchivo = `/api/fotografias/${foto.idFotografia}`;
      foto.formato = real.formato;
      foto.tamanoBytes = real.bytes.length;
      a.contenidosFoto[foto.idFotografia] = { tipo: real.tipo, bytes: real.bytes };
    }
    a.fotografias.push(foto);
    const perro: T.Perro = {
      idPerro: siguienteId(a, "perro"), nombre: c.nombre, sexo: c.sexo, edadValor: c.edadValor, edadUnidad: c.edadUnidad, tamano: c.tamano, color: c.color,
      caracteristicasDistintivas: c.caracteristicasDistintivas, ...razaDe(c.raza, a.razas), idUsuario: idDueno, idFotografia: foto.idFotografia,
    };
    if (c.razaEspecificada) perro.razaEspecificada = c.razaEspecificada;
    a.perros.push(perro);
    const ultimo = c.historial[c.historial.length - 1];
    const caso: T.CasoExtravio = {
      idCasoExtravio: siguienteId(a, "caso"), folio: c.folio, fechaExtravio: c.fechaExtravio, momentoDelDia: c.momentoDelDia, coloniaZona: c.coloniaZona,
      direccionAproximada: c.direccionAproximada, referenciasDelLugar: c.referenciasDelLugar, descripcionCircunstancias: c.descripcionCircunstancias,
      fechaRegistro: c.fechaRegistro, fechaUltimaModificacion: c.fechaRegistro,
      idAlcaldia: idPorNombre(a.alcaldias, c.alcaldia, (x) => x.idAlcaldia, "alcaldía"), idMotivo: idPorNombre(a.motivos, c.motivo, (x) => x.idMotivo, "motivo"),
      idEstadoCaso: idEstado(ultimo.estado), // E1: el estado actual repite el último movimiento
      idPerro: perro.idPerro,
    };
    a.casos.push(caso);
    for (const m of c.historial) {
      a.historial.push({
        idCasoExtravio: caso.idCasoExtravio, consecutivo: m.consecutivo, fechaHora: m.fechaHora, tipoMovimiento: m.tipo, motivo: m.motivo, idEstadoCaso: idEstado(m.estado),
        idUsuario: AUTOMATICOS.has(m.tipo) ? null : m.tipo === "deshabilitación" || m.tipo === "restauración" ? ID_ADMIN : idDueno,
      });
    }
    a.qr.push({ idCodigoQr: siguienteId(a, "qr"), idCasoExtravio: caso.idCasoExtravio, tokenPublico: origen?.tokenPublico ?? tokenDeMaqueta(c.folio), fechaGeneracion: c.historial[1]?.fechaHora ?? c.fechaRegistro, fechaInvalidacion: null });
  }
  const casoPorFolio = (folio: string) => a.casos.find((c) => c.folio === folio)!;

  // ---- Avistamientos (visibles y ocultos) con sus estados del animal y su notificación ----
  const todos = [...AVISTAMIENTOS, ...AVISTAMIENTOS_OCULTOS_ORIGEN].sort((x, y) => x.id - y.id);
  for (const v of todos) {
    const foto: T.Fotografia = { idFotografia: siguienteId(a, "fotografia"), referenciaArchivo: v.fotografiaUrl, formato: "JPG", tamanoBytes: 90_000, fechaCarga: v.fechaHora };
    // P4: foto real del avistamiento (src/server/seed/fotos/avistamientos/<ID>.jpg, generadas con `npm run preparar-fotos -- --avistamientos`); sin ella, el marcador de siempre.
    const real = carpetaFotos ? leerFotoSembrada(join(carpetaFotos, "avistamientos"), String(v.id)) : undefined;
    if (real) {
      foto.referenciaArchivo = `/api/fotografias/${foto.idFotografia}`;
      foto.formato = real.formato;
      foto.tamanoBytes = real.bytes.length;
      a.contenidosFoto[foto.idFotografia] = { tipo: real.tipo, bytes: real.bytes };
    }
    a.fotografias.push(foto);
    const visible = "visible" in v ? (v as { visible: boolean }).visible : true;
    const motivo = "motivoModeracion" in v ? (v as { motivoModeracion?: string }).motivoModeracion : undefined;
    const av: T.Avistamiento = {
      idAvistamiento: v.id, fechaHoraAvistamiento: v.fechaHora, direccionAproximada: v.direccionAproximada, coloniaZona: v.coloniaZona, referenciasDelLugar: v.referencias,
      latitud: v.latitud, longitud: v.longitud, precisionGps: v.precisionGps, comentario: v.comentario, fechaHoraEnvio: v.fechaHora,
      visible, motivoModeracion: visible ? undefined : motivo, idAlcaldia: idPorNombre(a.alcaldias, v.alcaldia, (x) => x.idAlcaldia, "alcaldía"),
      idCasoExtravio: casoPorFolio(v.folio).idCasoExtravio, idFotografia: foto.idFotografia,
    };
    a.avistamientos.push(av);
    a.ids.avistamiento = Math.max(a.ids.avistamiento ?? 0, v.id);
    v.estadosAnimal.forEach((n) => a.avistamientoEstados.push({ idAvistamiento: v.id, idEstadoAnimal: idPorNombre(a.estadosAnimal, n, (x) => x.idEstadoAnimal, "estado del animal") }));
    a.notificaciones.push({ idNotificacion: siguienteId(a, "notificacion"), tipo: "nuevo avistamiento", canal: "correo", fechaEnvio: v.fechaHora, estadoEnvio: "enviada", idAvistamiento: v.id });
  }
  // P5 (HU 040): todos los avistamientos sembrados cuentan como vistos, salvo el más reciente VISIBLE de los casos en «Avistamiento reportado» (Luna y Bruno), que quedan NUEVOS.
  for (const folio of ["RUPE-P3H8WD5N", "RUPE-N8D5GX3W"]) {
    const idCaso = casoPorFolio(folio).idCasoExtravio;
    const masReciente = a.avistamientos.filter((x) => x.idCasoExtravio === idCaso && x.visible).sort((x, y) => y.fechaHoraEnvio.localeCompare(x.fechaHoraEnvio) || y.idAvistamiento - x.idAvistamiento)[0];
    if (masReciente) masReciente.vistoPorTutora = false;
  }

  // ---- Bitácora (la misma de ADM-12); el ID afectado sigue el diccionario: id del caso, o «catalogo:id» ----
  [...BITACORA].sort((x, y) => x.id - y.id).forEach((b) => {
    const [nombreCatalogo, idCatalogo] = b.idEntidad.split(" · ");
    const idAfectada = b.entidad === "caso" ? String(casoPorFolio(b.idEntidad).idCasoExtravio) : b.entidad === "catálogo" ? `${ETIQUETA_CATALOGO[nombreCatalogo]}:${idCatalogo}` : b.idEntidad;
    a.bitacora.push({ idBitacoraAdmin: b.id, tipoAccion: b.tipo, idAfectada, motivo: b.motivo, detalle: b.detalle, fechaHora: b.fechaHora, idUsuario: usuarioPorNombre(b.administrador) });
    a.ids.bitacora = Math.max(a.ids.bitacora ?? 0, b.id);
  });
  // P6a: el seed deja TODOS los catálogos activos, pero el historial sembrado registra desactivaciones (alcaldía 12, raza 6, motivo 2 y estados del animal 16 y 17). Para que el historial sea coherente con el
  // seed, se siembran sus 5 REACTIVACIONES («edición de catálogo»: reactivar = editar, R9), POSTERIORES a las desactivaciones. La bitácora del almacén pasa de 25 a 30 entradas (medido); la pantalla del maqueta (que
  // todavía lee `mocks/bitacora.ts`) conserva las 26 hasta que lea el almacén (Etapa 2).
  const REACTIVACIONES = [
    { id: "alcaldia:12", detalle: "Inactiva → Activa", fechaHora: "2026-10-18T11:05:00Z" }, { id: "raza:6", detalle: "Inactivo → Activo", fechaHora: "2026-10-18T11:10:00Z" },
    { id: "motivo:2", detalle: "Inactivo → Activo", fechaHora: "2026-10-18T11:15:00Z" }, { id: "estado_animal:16", detalle: "Inactivo → Activo", fechaHora: "2026-10-18T11:20:00Z" },
    { id: "estado_animal:17", detalle: "Inactivo → Activo", fechaHora: "2026-10-18T11:25:00Z" },
  ];
  for (const r of REACTIVACIONES) {
    a.bitacora.push({ idBitacoraAdmin: siguienteId(a, "bitacora"), tipoAccion: "edición de catálogo", idAfectada: r.id, detalle: r.detalle, fechaHora: r.fechaHora, idUsuario: usuarioPorNombre("Ricardo Vega Ficticio") });
  }

  return a;
}
