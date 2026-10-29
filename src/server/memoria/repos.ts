import "server-only";
// Implementación en memoria de las interfaces de repos/. Cada método devuelve copias (structuredClone): quien llama nunca muta el almacén.
import type * as T from "../tipos";
import type { Repositorios } from "../repos";
import { ConflictoDeUnicidad } from "../repos/errores";
import { validarEntrada, type EntradaNueva } from "../dominio/bitacora";
import { errorAvistamientoYaOculto, errorAvistamientoYaVisible, errorCasoYaCambio } from "../dominio/moderacion";
import { errorConfirmarSesionPropia, errorSinCambioDeCuenta, errorUltimoAdministrador, esUltimoAdministradorActivo, validarRol } from "../dominio/usuarios";
import { ErrorApp } from "../errores";
import { qrPorToken } from "../dominio/qr";
import { estadoActual, registrarMovimiento } from "../dominio/transiciones";
import type { EstadoCaso, MovimientoHistorial } from "../../mocks/tipos";
import { obtenerAlmacen, siguienteId, type Almacen } from "./almacen";
import { transaccion } from "./transaccion";

const copia = <X,>(x: X): X => structuredClone(x);

/**
 * R12 sobre el almacén (P5): valida la transición con la matriz, agrega el movimiento (consecutivo = máximo + 1, R4) y actualiza el estado del caso. SÍNCRONA: se usa dentro de
 * `transaccion`, así que nadie puede intercalarse entre la lectura del historial y la escritura. Lanza 409/422 de la matriz sin dejar nada a medias.
 */
function aplicarMovimiento(al: Almacen, idCaso: number, m: { tipo: T.TipoMovimiento; actor: Parameters<typeof registrarMovimiento>[2]; motivo?: string; idUsuario: number | null; fechaHora: string }) {
  const nombre = (id: number) => al.estadosCaso.find((e) => e.idEstadoCaso === id)!.nombre as EstadoCaso;
  const idDe = (n: EstadoCaso) => al.estadosCaso.find((e) => e.nombre === n)!.idEstadoCaso;
  const caso = al.casos.find((c) => c.idCasoExtravio === idCaso);
  if (!caso) throw new Error("Caso inexistente");
  const previos = al.historial.filter((x) => x.idCasoExtravio === idCaso).sort((x, y) => x.consecutivo - y.consecutivo);
  const historial: MovimientoHistorial[] = previos.map((x) => ({ consecutivo: x.consecutivo, fechaHora: x.fechaHora, tipo: x.tipoMovimiento, estado: nombre(x.idEstadoCaso), ...(x.motivo ? { motivo: x.motivo } : {}) }));
  const nuevo = registrarMovimiento(historial, m.tipo, m.actor, m.fechaHora, m.motivo).at(-1)!; // 409 si la transición no vale, 422 sin motivo
  const fila: T.MovimientoDeHistorial = { idCasoExtravio: idCaso, consecutivo: nuevo.consecutivo, fechaHora: nuevo.fechaHora, tipoMovimiento: nuevo.tipo, idEstadoCaso: idDe(nuevo.estado), idUsuario: m.idUsuario, ...(nuevo.motivo ? { motivo: nuevo.motivo } : {}) };
  al.historial.push(fila);
  caso.idEstadoCaso = fila.idEstadoCaso; // `fechaUltimaModificacion` es la fecha de EDICIÓN (HU 014): un cambio de estado no la mueve; su fecha vive en el historial
  return { movimiento: fila, estado: nuevo.estado };
}

/** R24: inserta la entrada de bitácora (validada) dentro de la transacción de la acción. Solo se agrega: nunca se edita ni se borra (R15). */
function agregarBitacora(al: Almacen, e: EntradaNueva & { idUsuario: number; fechaHora: string }): T.AccionBitacoraReg {
  const v = validarEntrada(e);
  const fila: T.AccionBitacoraReg = { idBitacoraAdmin: siguienteId(al, "bitacora"), tipoAccion: v.tipoAccion, idAfectada: v.idAfectada, ...(v.motivo ? { motivo: v.motivo } : {}), ...(v.detalle ? { detalle: v.detalle } : {}), fechaHora: e.fechaHora, idUsuario: e.idUsuario };
  al.bitacora.push(fila);
  return fila;
}

/** La matriz R12 rechaza una transición que ya no vale con un 409 técnico: para el Administrador se responde el mensaje amable de «ya cambió». */
function movimientoDeModeracion(al: Almacen, idCaso: number, m: Parameters<typeof aplicarMovimiento>[2]) {
  try {
    return aplicarMovimiento(al, idCaso, m);
  } catch (e) {
    if (e instanceof ErrorApp && e.estado === 409 && e.codigo === "TRANSICION_INVALIDA") throw errorCasoYaCambio();
    throw e;
  }
}

/** Cierra todas las sesiones activas de la cuenta (R19) y dice cuántas eran. */
function cerrarSesiones(al: Almacen, idUsuario: number, fecha: string): number {
  const activas = al.sesiones.filter((s) => s.idUsuario === idUsuario && !s.fechaCierre);
  activas.forEach((s) => (s.fechaCierre = fecha));
  return activas.length;
}

export function crearRepositorios(almacen: () => Almacen = obtenerAlmacen): Repositorios {
  const a = almacen;
  return {
    usuarios: {
      async porId(id) { return copia(a().usuarios.find((u) => u.idUsuario === id)); },
      async porCorreo(correo) { return copia(a().usuarios.find((u) => u.correo.toLowerCase() === correo.trim().toLowerCase())); },
      async todos() { return copia(a().usuarios); },
      async guardar(u) {
        const lista = a().usuarios;
        const i = lista.findIndex((x) => x.idUsuario === u.idUsuario);
        if (i >= 0) lista[i] = copia(u);
        else lista.push(copia(u));
      },
      async cambiarEstatus(idUsuario, estatus, fecha) {
        const u = a().usuarios.find((x) => x.idUsuario === idUsuario);
        if (u) { u.estatus = estatus; u.fechaUltimaModificacion = fecha; }
      },
      async cambiarRol(idUsuario, rol, fecha) {
        const u = a().usuarios.find((x) => x.idUsuario === idUsuario);
        if (u) { u.rol = rol; u.fechaUltimaModificacion = fecha; }
      },
      async crearConAceptacion(u, versionAviso, fechaHora) {
        const al = a();
        if (al.usuarios.some((x) => x.correo.toLowerCase() === u.correo.toLowerCase())) throw new Error("Correo duplicado"); // UNIQUE
        const nuevo: T.Usuario = { ...u, idUsuario: siguienteId(al, "usuario") };
        al.usuarios.push(nuevo);
        al.aceptaciones.push({ idAceptacionAviso: siguienteId(al, "aceptacion"), versionAviso, fechaHora, idUsuario: nuevo.idUsuario });
        return copia(nuevo);
      },
    },
    aceptaciones: {
      async ultimaDe(idUsuario) {
        const propias = a().aceptaciones.filter((x) => x.idUsuario === idUsuario);
        return copia(propias.sort((x, y) => y.fechaHora.localeCompare(x.fechaHora) || y.idAceptacionAviso - x.idAceptacionAviso)[0]);
      },
      async agregar(x) { const nueva = { ...x, idAceptacionAviso: siguienteId(a(), "aceptacion") }; a().aceptaciones.push(nueva); return copia(nueva); },
      async deUsuario(idUsuario) { return copia(a().aceptaciones.filter((x) => x.idUsuario === idUsuario)); },
    },
    intentos: {
      async de(correo) { return copia(a().intentosAnonimos[correo.trim().toLowerCase()] ?? { intentos: 0, bloqueadoHasta: null }); },
      async guardar(correo, estado) { a().intentosAnonimos[correo.trim().toLowerCase()] = copia(estado); },
      async limpiar(correo) { delete a().intentosAnonimos[correo.trim().toLowerCase()]; },
    },
    sesiones: {
      async crear(s) { const nueva = { ...s, idSesion: siguienteId(a(), "sesion") }; a().sesiones.push(nueva); return copia(nueva); },
      async porTokenHash(hash) { return copia(a().sesiones.find((s) => s.tokenHash === hash)); },
      async cerrar(id, fecha) { const s = a().sesiones.find((x) => x.idSesion === id); if (s && !s.fechaCierre) s.fechaCierre = fecha; },
      async cerrarTodasDe(idUsuario, fecha) {
        const activas = a().sesiones.filter((s) => s.idUsuario === idUsuario && !s.fechaCierre);
        activas.forEach((s) => (s.fechaCierre = fecha));
        return activas.length;
      },
    },
    casos: {
      async porId(id) { return copia(a().casos.find((c) => c.idCasoExtravio === id)); },
      async porFolio(folio) { return copia(a().casos.find((c) => c.folio.toUpperCase() === folio.trim().toUpperCase())); },
      async todos() { return copia(a().casos); },
      async perro(id) { return copia(a().perros.find((p) => p.idPerro === id)); },
      async fotografia(id) { return copia(a().fotografias.find((f) => f.idFotografia === id)); },
      async crearConPerro(d) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const folio = d.caso.folio.toUpperCase();
            if (al.casos.some((c) => c.folio === folio)) throw new ConflictoDeUnicidad("folio"); // UNIQUE
            if (al.qr.some((q) => q.tokenPublico === d.qr.tokenPublico)) throw new ConflictoDeUnicidad("token"); // UNIQUE
            const foto: T.Fotografia = { ...d.fotografia, idFotografia: siguienteId(al, "fotografia") };
            if (d.contenidoFotografia) {
              foto.referenciaArchivo = `/api/fotografias/${foto.idFotografia}`; // la ruta con guarda de dueño; sin BLOB ni archivo
              al.contenidosFoto[foto.idFotografia] = { tipo: d.contenidoFotografia.tipo, bytes: Uint8Array.from(d.contenidoFotografia.bytes) };
            }
            const perro: T.Perro = { ...d.perro, idPerro: siguienteId(al, "perro"), idFotografia: foto.idFotografia };
            const caso: T.CasoExtravio = { ...d.caso, folio, idCasoExtravio: siguienteId(al, "caso"), idPerro: perro.idPerro, idEstadoCaso: d.movimientos[d.movimientos.length - 1]?.idEstadoCaso ?? 1 };
            al.fotografias.push(foto);
            al.perros.push(perro);
            al.casos.push(caso);
            al.qr.push({ ...d.qr, idCodigoQr: siguienteId(al, "qr"), idCasoExtravio: caso.idCasoExtravio });
            d.movimientos.forEach((m, i) => al.historial.push({ ...m, idCasoExtravio: caso.idCasoExtravio, consecutivo: i + 1 }));
            return caso;
          }),
        );
      },
      async contenidoDeFotografia(id) {
        const c = a().contenidosFoto[id];
        return c ? { tipo: c.tipo, bytes: Uint8Array.from(c.bytes) } : undefined;
      },
      async duenoDeFotografia(id) {
        const al = a();
        const delPerro = al.perros.find((p) => p.idFotografia === id);
        if (delPerro) return delPerro.idUsuario;
        const av = al.avistamientos.find((x) => x.idFotografia === id);
        const caso = av && al.casos.find((c) => c.idCasoExtravio === av.idCasoExtravio);
        return caso && al.perros.find((p) => p.idPerro === caso.idPerro)?.idUsuario;
      },
      async actualizarEstado(idCaso, idEstadoCaso, fecha) {
        const c = a().casos.find((x) => x.idCasoExtravio === idCaso);
        void fecha; // la fecha del cambio de estado está en el historial; `fechaUltimaModificacion` solo la mueven el alta y la edición (HU 014)
        if (c) c.idEstadoCaso = idEstadoCaso;
      },
    },
    historial: {
      async deCaso(id) { return copia(a().historial.filter((m) => m.idCasoExtravio === id).sort((x, y) => x.consecutivo - y.consecutivo)); },
      async agregar(m) {
        const previos = a().historial.filter((x) => x.idCasoExtravio === m.idCasoExtravio);
        const nuevo = { ...m, consecutivo: previos.reduce((mx, x) => Math.max(mx, x.consecutivo), 0) + 1 };
        a().historial.push(nuevo);
        return copia(nuevo);
      },
      async registrar(idCaso, m) {
        const al = a();
        return copia(transaccion(al, () => aplicarMovimiento(al, idCaso, m)));
      },
    },
    qr: {
      async activoDe(id) { return copia(a().qr.find((q) => q.idCasoExtravio === id && q.fechaInvalidacion === null)); },
      async porToken(token) { return copia(qrPorToken(a().qr, token)); }, // tiempo constante y sensible a mayúsculas (E6)
      async deCaso(id) { return copia(a().qr.filter((q) => q.idCasoExtravio === id)); },
      /** R7: invalida el QR vigente y crea el nuevo en UNA transacción (si algo falla no queda el caso sin QR activo ni dos activos). */
      async regenerar(id, tokenNuevo, fecha) {
        const al = a();
        return copia(
          transaccion(al, () => {
            if (al.qr.some((q) => q.tokenPublico === tokenNuevo)) throw new ConflictoDeUnicidad("token"); // UNIQUE
            al.qr.filter((q) => q.idCasoExtravio === id && q.fechaInvalidacion === null).forEach((q) => (q.fechaInvalidacion = fecha));
            const nuevo: T.CodigoQr = { idCodigoQr: siguienteId(al, "qr"), idCasoExtravio: id, tokenPublico: tokenNuevo, fechaGeneracion: fecha, fechaInvalidacion: null };
            al.qr.push(nuevo);
            return nuevo;
          }),
        );
      },
    },
    avistamientos: {
      async porId(id) { return copia(a().avistamientos.find((x) => x.idAvistamiento === id)); },
      async deCaso(id) { return copia(a().avistamientos.filter((x) => x.idCasoExtravio === id).sort((x, y) => y.fechaHoraEnvio.localeCompare(x.fechaHoraEnvio))); },
      async todos() { return copia(a().avistamientos); },
      async estadosDe(id) { return a().avistamientoEstados.filter((e) => e.idAvistamiento === id).map((e) => e.idEstadoAnimal); },
      async crear(av, foto, estados) {
        const al = a();
        const f: T.Fotografia = { ...foto, idFotografia: siguienteId(al, "fotografia") };
        const nuevo: T.Avistamiento = { ...av, idAvistamiento: siguienteId(al, "avistamiento"), idFotografia: f.idFotografia };
        al.fotografias.push(f); al.avistamientos.push(nuevo);
        estados.forEach((e) => al.avistamientoEstados.push({ idAvistamiento: nuevo.idAvistamiento, idEstadoAnimal: e }));
        return copia(nuevo);
      },
      async registrarCompleto(alta) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const foto: T.Fotografia = { ...alta.fotografia, idFotografia: siguienteId(al, "fotografia") };
            foto.referenciaArchivo = `/api/fotografias/${foto.idFotografia}`; // ruta con guarda; la foto se vincula al ID del avistamiento, nunca a una persona visitante
            al.contenidosFoto[foto.idFotografia] = { tipo: alta.contenidoFotografia.tipo, bytes: Uint8Array.from(alta.contenidoFotografia.bytes) };
            al.fotografias.push(foto);
            const av: T.Avistamiento = { ...alta.avistamiento, idAvistamiento: siguienteId(al, "avistamiento"), idFotografia: foto.idFotografia };
            al.avistamientos.push(av);
            alta.estados.forEach((e) => al.avistamientoEstados.push({ idAvistamiento: av.idAvistamiento, idEstadoAnimal: e }));
            if (alta.movimiento) {
              const previos = al.historial.filter((m) => m.idCasoExtravio === av.idCasoExtravio);
              al.historial.push({ idCasoExtravio: av.idCasoExtravio, consecutivo: previos.reduce((mx, x) => Math.max(mx, x.consecutivo), 0) + 1, fechaHora: alta.movimiento.fechaHora, tipoMovimiento: alta.movimiento.tipoMovimiento, idEstadoCaso: alta.movimiento.idEstadoCaso, idUsuario: null });
              const caso = al.casos.find((c) => c.idCasoExtravio === av.idCasoExtravio)!;
              caso.idEstadoCaso = alta.movimiento.idEstadoCaso; // recibir un avistamiento no edita el caso (HU 014): `fechaUltimaModificacion` no cambia
            }
            let notificacion: T.Notificacion | undefined;
            if (alta.notificacion) {
              notificacion = { ...alta.notificacion, idNotificacion: siguienteId(al, "notificacion"), idAvistamiento: av.idAvistamiento };
              al.notificaciones.push(notificacion);
            }
            return { avistamiento: av, notificacion };
          }),
        );
      },
      async marcarVisto(id, fechaHora) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const av = al.avistamientos.find((x) => x.idAvistamiento === id);
            if (!av) throw new Error("Avistamiento inexistente");
            const nombre = (idEstado: number) => al.estadosCaso.find((e) => e.idEstadoCaso === idEstado)!.nombre as EstadoCaso;
            const previos = al.historial.filter((x) => x.idCasoExtravio === av.idCasoExtravio).sort((x, y) => x.consecutivo - y.consecutivo);
            const estadoAntes = estadoActual(previos.map((x) => ({ consecutivo: x.consecutivo, fechaHora: x.fechaHora, tipo: x.tipoMovimiento, estado: nombre(x.idEstadoCaso) })))!;
            if (av.vistoPorTutora !== false) return { cambio: false, estado: estadoAntes };
            av.vistoPorTutora = true;
            // Solo desde «Avistamiento reportado» la matriz mueve el caso a «En seguimiento» (movimiento automático: sin usuario).
            if (estadoAntes !== "Avistamiento reportado") return { cambio: true, estado: estadoAntes };
            const r = aplicarMovimiento(al, av.idCasoExtravio, { tipo: "avistamiento revisado", actor: "automático", idUsuario: null, fechaHora });
            return { cambio: true, movimiento: r.movimiento, estado: r.estado };
          }),
        );
      },
      async marcarRelevante(id, relevante) {
        const x = a().avistamientos.find((v) => v.idAvistamiento === id);
        if (x) x.relevante = relevante;
      },
      async moderar(id, visible, motivo) {
        const x = a().avistamientos.find((v) => v.idAvistamiento === id);
        if (!x) return;
        x.visible = visible;
        x.motivoModeracion = visible ? undefined : motivo; // restaurar limpia el motivo
      },
    },
    notificaciones: {
      async crear(n) { const nueva = { ...n, idNotificacion: siguienteId(a(), "notificacion") }; a().notificaciones.push(nueva); return copia(nueva); },
      async deAvistamiento(id) { return copia(a().notificaciones.find((n) => n.idAvistamiento === id)); },
      async todas() { return copia(a().notificaciones); },
    },
    bitacora: {
      async agregar(x) { const nueva = { ...x, idBitacoraAdmin: siguienteId(a(), "bitacora") }; a().bitacora.push(nueva); return copia(nueva); },
      async todas() { return copia([...a().bitacora].sort((x, y) => y.idBitacoraAdmin - x.idBitacoraAdmin)); },
    },
    catalogos: {
      async alcaldias() { return copia(a().alcaldias); },
      async razas() { return copia(a().razas); },
      async categoriasMotivo() { return copia(a().categoriasMotivo); },
      async motivos() { return copia(a().motivos); },
      async categoriasEstadoAnimal() { return copia(a().categoriasEstadoAnimal); },
      async estadosAnimal() { return copia(a().estadosAnimal); },
      async estadosCaso() { return copia(a().estadosCaso); },
    },
    administracion: {
      async deshabilitarCaso(idCaso, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const r = movimientoDeModeracion(al, idCaso, { tipo: "deshabilitación", actor: "Administrador", motivo: e.motivo, idUsuario: e.idAdministrador, fechaHora: e.fecha });
            const entrada = agregarBitacora(al, { tipoAccion: "deshabilitar caso", idAfectada: String(idCaso), motivo: e.motivo, idUsuario: e.idAdministrador, fechaHora: e.fecha });
            return { movimiento: r.movimiento, estado: r.estado, entrada };
          }),
        );
      },
      async restaurarCaso(idCaso, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const r = movimientoDeModeracion(al, idCaso, { tipo: "restauración", actor: "Administrador", idUsuario: e.idAdministrador, fechaHora: e.fecha });
            const entrada = agregarBitacora(al, { tipoAccion: "restaurar caso", idAfectada: String(idCaso), idUsuario: e.idAdministrador, fechaHora: e.fecha });
            return { movimiento: r.movimiento, estado: r.estado, entrada };
          }),
        );
      },
      async ocultarAvistamiento(idAvistamiento, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const av = al.avistamientos.find((x) => x.idAvistamiento === idAvistamiento);
            if (!av) throw new Error("Avistamiento inexistente");
            if (!av.visible) throw errorAvistamientoYaOculto();
            const entrada = agregarBitacora(al, { tipoAccion: "ocultar avistamiento", idAfectada: String(idAvistamiento), motivo: e.motivo, idUsuario: e.idAdministrador, fechaHora: e.fecha }); // valida el motivo ANTES de cambiar nada
            av.visible = false;
            av.motivoModeracion = entrada.motivo; // CHECK: oculto ⇒ con motivo
            return { entrada };
          }),
        );
      },
      async restaurarAvistamiento(idAvistamiento, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const av = al.avistamientos.find((x) => x.idAvistamiento === idAvistamiento);
            if (!av) throw new Error("Avistamiento inexistente");
            if (av.visible) throw errorAvistamientoYaVisible();
            av.visible = true;
            av.motivoModeracion = undefined; // restaurar limpia el motivo (D12)
            return { entrada: agregarBitacora(al, { tipoAccion: "restaurar avistamiento", idAfectada: String(idAvistamiento), idUsuario: e.idAdministrador, fechaHora: e.fecha }) };
          }),
        );
      },
      async deshabilitarUsuario(idUsuario, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const u = al.usuarios.find((x) => x.idUsuario === idUsuario);
            if (!u) throw new Error("Usuario inexistente");
            if (u.estatus === 0) throw errorSinCambioDeCuenta("La cuenta ya está deshabilitada.");
            if (esUltimoAdministradorActivo(al.usuarios, idUsuario)) throw errorUltimoAdministrador(); // R21
            const propia = idUsuario === e.idAdministrador;
            if (propia && !e.confirmarSesionPropia) throw errorConfirmarSesionPropia();
            u.estatus = 0;
            u.fechaUltimaModificacion = e.fecha;
            const sesionesCerradas = cerrarSesiones(al, idUsuario, e.fecha); // R19, en la misma transacción
            const entrada = agregarBitacora(al, { tipoAccion: "deshabilitar usuario", idAfectada: String(idUsuario), idUsuario: e.idAdministrador, fechaHora: e.fecha });
            return { usuario: u, sesionesCerradas, esLaPropiaCuenta: propia, entrada };
          }),
        );
      },
      async habilitarUsuario(idUsuario, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const u = al.usuarios.find((x) => x.idUsuario === idUsuario);
            if (!u) throw new Error("Usuario inexistente");
            if (u.estatus === 1) throw errorSinCambioDeCuenta("La cuenta ya está habilitada.");
            u.estatus = 1;
            u.fechaUltimaModificacion = e.fecha;
            const entrada = agregarBitacora(al, { tipoAccion: "habilitar usuario", idAfectada: String(idUsuario), idUsuario: e.idAdministrador, fechaHora: e.fecha });
            return { usuario: u, sesionesCerradas: 0, esLaPropiaCuenta: idUsuario === e.idAdministrador, entrada };
          }),
        );
      },
      async cambiarRolDeUsuario(idUsuario, rolNuevo, e) {
        const al = a();
        return copia(
          transaccion(al, () => {
            const u = al.usuarios.find((x) => x.idUsuario === idUsuario);
            if (!u) throw new Error("Usuario inexistente");
            const rol = validarRol(rolNuevo);
            if (u.rol === rol) throw errorSinCambioDeCuenta("La persona ya tiene ese rol.");
            if (esUltimoAdministradorActivo(al.usuarios, idUsuario)) throw errorUltimoAdministrador(); // R21: deja de ser administradora
            const propia = idUsuario === e.idAdministrador;
            if (propia && !e.confirmarSesionPropia) throw errorConfirmarSesionPropia();
            const rolAnterior = u.rol;
            u.rol = rol;
            u.fechaUltimaModificacion = e.fecha;
            const sesionesCerradas = cerrarSesiones(al, idUsuario, e.fecha);
            const entrada = agregarBitacora(al, { tipoAccion: "cambiar rol", idAfectada: String(idUsuario), detalle: `${rolAnterior} → ${rol}`, idUsuario: e.idAdministrador, fechaHora: e.fecha });
            return { usuario: u, sesionesCerradas, esLaPropiaCuenta: propia, rolAnterior, entrada };
          }),
        );
      },
    },
    parametros: {
      async todos() { return copia(a().parametros); },
      async valor(clave) { return a().parametros.find((p) => p.clave === clave)!.valor; },
      async actualizar(clave, valor) { const p = a().parametros.find((x) => x.clave === clave); if (p) p.valor = valor; },
    },
  };
}
