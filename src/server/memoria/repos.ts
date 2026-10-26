import "server-only";
// Implementación en memoria de las interfaces de repos/. Cada método devuelve copias (structuredClone): quien llama nunca muta el almacén.
import type * as T from "../tipos";
import type { Repositorios } from "../repos";
import { ConflictoDeUnicidad } from "../repos/errores";
import { obtenerAlmacen, siguienteId, type Almacen } from "./almacen";
import { transaccion } from "./transaccion";

const copia = <X,>(x: X): X => structuredClone(x);

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
        if (c) { c.idEstadoCaso = idEstadoCaso; c.fechaUltimaModificacion = fecha; }
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
    },
    qr: {
      async activoDe(id) { return copia(a().qr.find((q) => q.idCasoExtravio === id && q.fechaInvalidacion === null)); },
      async porToken(token) { return copia(a().qr.find((q) => q.tokenPublico === token)); }, // sensible a mayúsculas (E6)
      async deCaso(id) { return copia(a().qr.filter((q) => q.idCasoExtravio === id)); },
      async regenerar(id, tokenNuevo, fecha) {
        const al = a();
        if (al.qr.some((q) => q.tokenPublico === tokenNuevo)) throw new Error("Token duplicado");
        al.qr.filter((q) => q.idCasoExtravio === id && q.fechaInvalidacion === null).forEach((q) => (q.fechaInvalidacion = fecha));
        const nuevo: T.CodigoQr = { idCodigoQr: siguienteId(al, "qr"), idCasoExtravio: id, tokenPublico: tokenNuevo, fechaGeneracion: fecha, fechaInvalidacion: null };
        al.qr.push(nuevo);
        return copia(nuevo);
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
    parametros: {
      async todos() { return copia(a().parametros); },
      async valor(clave) { return a().parametros.find((p) => p.clave === clave)!.valor; },
      async actualizar(clave, valor) { const p = a().parametros.find((x) => x.clave === clave); if (p) p.valor = valor; },
    },
  };
}
