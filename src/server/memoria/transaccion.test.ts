import assert from "node:assert/strict";
import { test } from "node:test";
import { nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import { ConflictoDeUnicidad } from "../repos/errores";
import { transaccion } from "./transaccion";

const alta = (folio: string, token: string, fallar = false) => ({
  fotografia: { referenciaArchivo: "", formato: "JPG" as const, tamanoBytes: 600, fechaCarga: "2026-10-18T12:00:00Z" },
  contenidoFotografia: { tipo: "image/jpeg", bytes: jpeg() },
  perro: { nombre: "Nube", sexo: "Hembra" as const, edadValor: 2, edadUnidad: "años" as const, tamano: "pequeño" as const, color: "Blanco", idRaza: 1, idUsuario: 2 },
  caso: { folio, fechaExtravio: "2026-10-18", momentoDelDia: "tarde" as const, coloniaZona: "Centro", fechaRegistro: "2026-10-18T12:00:00Z", fechaUltimaModificacion: "2026-10-18T12:00:00Z", idAlcaldia: 4, idMotivo: 1 },
  qr: { tokenPublico: token, fechaGeneracion: "2026-10-18T12:00:00Z", fechaInvalidacion: null },
  // Un movimiento que falla AL RECORRERLO, cuando la foto, el perro, el caso y el QR ya se agregaron: la transacción debe deshacerlo todo.
  movimientos: fallar
    ? [{ fechaHora: "2026-10-18T12:00:00Z", tipoMovimiento: "registro" as const, idEstadoCaso: 1, idUsuario: null }, { fechaHora: "t", tipoMovimiento: "ficha generada" as const, get idEstadoCaso(): number { throw new Error("fallo a mitad de la transacción"); }, idUsuario: null }]
    : [{ fechaHora: "2026-10-18T12:00:00Z", tipoMovimiento: "registro" as const, idEstadoCaso: 1, idUsuario: null }, { fechaHora: "2026-10-18T12:00:00Z", tipoMovimiento: "ficha generada" as const, idEstadoCaso: 2, idUsuario: null }],
});

const estado = (a: ReturnType<typeof nuevoContexto>["almacen"]) => ({
  ids: JSON.stringify(a.ids),
  largos: [a.fotografias.length, a.perros.length, a.casos.length, a.historial.length, a.qr.length, a.usuarios.length, a.sesiones.length, a.avistamientos.length, a.notificaciones.length, a.bitacora.length],
  fotos: Object.keys(a.contenidosFoto).sort(),
  bytes: Object.entries(a.contenidosFoto).map(([k, v]) => `${k}:${v.tipo}:${Buffer.from(v.bytes).toString("hex")}`).sort(),
  folios: a.casos.map((c) => c.folio),
  tokens: a.qr.map((q) => q.tokenPublico),
});

test("Transacción · tras un fallo a mitad, los BYTES de las fotos, los contadores de id y los folios quedan idénticos a antes (sin huérfanos)", async () => {
  const { ctx, almacen } = nuevoContexto();
  await ctx.repos.casos.crearConPerro(alta("RUPE-AAAAAAAA", "A".repeat(32))); // una alta buena antes, para que haya bytes de foto previos
  const antes = estado(almacen);
  assert.equal(antes.fotos.length, 1);
  await assert.rejects(ctx.repos.casos.crearConPerro(alta("RUPE-BBBBBBBB", "B".repeat(32), true)), /fallo a mitad/);
  assert.deepEqual(estado(almacen), antes); // ids, largos, bytes, folios y tokens: exactamente lo mismo
  // El siguiente alta toma los ids que habría tomado sin el fallo (no se consumieron).
  const ok = await ctx.repos.casos.crearConPerro(alta("RUPE-CCCCCCCC", "C".repeat(32)));
  const sinFallo = nuevoContexto();
  await sinFallo.ctx.repos.casos.crearConPerro(alta("RUPE-AAAAAAAA", "A".repeat(32)));
  const esperado = await sinFallo.ctx.repos.casos.crearConPerro(alta("RUPE-CCCCCCCC", "C".repeat(32)));
  assert.equal(ok.idCasoExtravio, esperado.idCasoExtravio);
  assert.equal(ok.idPerro, esperado.idPerro);
});

test("Transacción · un folio o un token repetido lanza ConflictoDeUnicidad y no deja nada", async () => {
  const { ctx, almacen } = nuevoContexto();
  await ctx.repos.casos.crearConPerro(alta("RUPE-AAAAAAAA", "A".repeat(32)));
  const antes = estado(almacen);
  await assert.rejects(ctx.repos.casos.crearConPerro(alta("rupe-aaaaaaaa", "B".repeat(32))), (e) => e instanceof ConflictoDeUnicidad && e.campo === "folio");
  await assert.rejects(ctx.repos.casos.crearConPerro(alta("RUPE-BBBBBBBB", "A".repeat(32))), (e) => e instanceof ConflictoDeUnicidad && e.campo === "token");
  assert.deepEqual(estado(almacen), antes);
});

test("Transacción · si todo sale bien se conserva y devuelve el resultado; el mensaje del conflicto no revela detalles internos", () => {
  const { almacen } = nuevoContexto();
  assert.equal(transaccion(almacen, () => { almacen.ids.prueba = 1; return 7; }), 7);
  assert.equal(almacen.ids.prueba, 1);
  assert.equal(new ConflictoDeUnicidad("folio").message, "Valor duplicado");
});
