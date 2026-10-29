import assert from "node:assert/strict";
import { test } from "node:test";
import type { EstadoCaso } from "../../mocks/tipos";
import { ErrorApp, respuestaDeError } from "../errores";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import type { SesionActual } from "../sesion/guardas";
import { registrarAvistamiento } from "./avistamientos";
import { abrirAvistamiento } from "./seguimiento";
import { cambiarEstadoDelCaso, cancelarCaso, cerrarCaso, marcarLocalizado, MENSAJE_YA_CAMBIO, reactivarCaso, type AccionDeEstado } from "./cambioDeEstado";
import { consultarEstatusPorFolio, consultarFichaPorFolio, consultarFichaPorToken } from "./fichas";
import { casoDelTutor, listarCasosDelTutor } from "./misRegistros";

const MAX = "RUPE-K7M4XQ9T"; // Rosa, En búsqueda
const COCO = "RUPE-H4TQ7V2M"; // Rosa, En búsqueda
const LUNA = "RUPE-P3H8WD5N"; // Rosa, Avistamiento reportado
const NALA = "RUPE-Y9F4LK2E"; // Rosa, En seguimiento
const TOBY = "RUPE-B6R2TZ7C"; // Rosa, Localizado
const ROCKY = "RUPE-3HN8WD2B"; // Rosa, Cerrado por cierre confirmado
const SIMBA = "RUPE-F7L3MN6Y"; // Luis, Cerrado por cancelación
const KIRA = "RUPE-D5W2QK8X"; // Luis, Cerrado por deshabilitación
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const FOTO = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const datos = (extra: Record<string, unknown> = {}) => ({ fecha: "2026-10-17", hora: "10:00", direccion: "Avenida Reservada 123, entre A y B", idAlcaldia: 6, coloniaZona: "Del Valle", referencias: "junto a la panadería", estadosAnimal: [1, 7], comentario: "Se ve bien", ...extra });
const huella = async (e: ErrorApp) => {
  const r = respuestaDeError(e);
  return JSON.stringify({ estado: r.status, cuerpo: await r.clone().text(), cabeceras: [...r.headers.entries()].sort() });
};
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const MOTIVO = "Lo encontré en casa de una vecina.";

/** Estado actual de un caso sembrado según el almacén. */
const estadoDe = async (ctx: ReturnType<typeof nuevoContexto>["ctx"], folio: string): Promise<EstadoCaso> => {
  const c = await casoDelTutor(ROSA, folio, ctx).catch(() => casoDelTutor(LUIS, folio, ctx));
  return c.estado;
};
const movimientos = (almacen: ReturnType<typeof nuevoContexto>["almacen"], folio: string) => {
  const id = almacen.casos.find((c) => c.folio === folio)!.idCasoExtravio;
  return almacen.historial.filter((m) => m.idCasoExtravio === id);
};

// ---------------------------------------------------------------------------------------------------------------------- matriz completa
type Caso = { folio: string; sesion: SesionActual; estado: EstadoCaso };
const CASOS: Caso[] = [
  { folio: MAX, sesion: ROSA, estado: "En búsqueda" }, { folio: LUNA, sesion: ROSA, estado: "Avistamiento reportado" }, { folio: NALA, sesion: ROSA, estado: "En seguimiento" },
  { folio: TOBY, sesion: ROSA, estado: "Localizado" }, { folio: ROCKY, sesion: ROSA, estado: "Cerrado" }, { folio: SIMBA, sesion: LUIS, estado: "Cerrado" }, { folio: KIRA, sesion: LUIS, estado: "Cerrado" },
];
const PERMITIDAS: Record<AccionDeEstado, { desde: EstadoCaso[]; hacia: EstadoCaso; tipo: string }> = {
  localizar: { desde: ["En búsqueda", "Avistamiento reportado", "En seguimiento"], hacia: "Localizado", tipo: "localización" },
  cerrar: { desde: ["Localizado"], hacia: "Cerrado", tipo: "cierre confirmado" },
  reactivar: { desde: ["Localizado"], hacia: "En seguimiento", tipo: "reactivación" },
  cancelar: { desde: ["En búsqueda", "Avistamiento reportado", "En seguimiento"], hacia: "Cerrado", tipo: "cancelación" },
};

test("R12 · matriz completa: cada acción × cada estado sembrado; solo las transiciones válidas pasan y las demás dan 409 sin tocar el historial", async () => {
  for (const accion of Object.keys(PERMITIDAS) as AccionDeEstado[]) {
    for (const c of CASOS) {
      const { ctx, almacen } = nuevoContexto();
      const antes = movimientos(almacen, c.folio).length;
      const p = cambiarEstadoDelCaso(c.sesion, c.folio, { accion, motivo: MOTIVO }, ctx);
      const regla = PERMITIDAS[accion];
      if (regla.desde.includes(c.estado)) {
        const r = await p;
        assert.equal(r.estado, regla.hacia, `${accion} desde ${c.estado}`);
        assert.equal(r.fechaCambio, AHORA.toISOString());
        const ult = movimientos(almacen, c.folio).at(-1)!;
        assert.equal(ult.tipoMovimiento, regla.tipo);
        assert.equal(ult.idUsuario, c.sesion.idUsuario, "el movimiento lo hace la persona tutora (id de la sesión)");
        assert.equal(movimientos(almacen, c.folio).length, antes + 1);
        assert.equal(await estadoDe(ctx, c.folio), regla.hacia);
      } else {
        const e = await falla(p);
        assert.equal(e?.estado, 409, `${accion} desde ${c.estado}`);
        assert.equal(e?.codigo, "TRANSICION_INVALIDA");
        assert.equal(e?.message, MENSAJE_YA_CAMBIO);
        assert.equal(movimientos(almacen, c.folio).length, antes, "una transición inválida no deja ningún movimiento");
      }
    }
  }
});

test("R12 · «Extraviado» (estado instantáneo, E1) también es origen válido de localizar y cancelar", async () => {
  for (const accion of ["localizar", "cancelar"] as const) {
    const { ctx, almacen } = nuevoContexto();
    const caso = almacen.casos.find((c) => c.folio === COCO)!;
    almacen.historial.splice(almacen.historial.findLastIndex((m) => m.idCasoExtravio === caso.idCasoExtravio), 1); // deja solo «registro» → Extraviado
    caso.idEstadoCaso = 1;
    assert.equal(await estadoDe(ctx, COCO), "Extraviado");
    const r = await cambiarEstadoDelCaso(ROSA, COCO, { accion, motivo: MOTIVO }, ctx);
    assert.equal(r.estado, PERMITIDAS[accion].hacia);
  }
});

test("R12 · reactivar y cerrar NUNCA salen de «Cerrado» (cierre confirmado, cancelación ni deshabilitación); localizar tampoco", async () => {
  for (const [folio, sesion] of [[ROCKY, ROSA], [SIMBA, LUIS], [KIRA, LUIS]] as const) {
    const { ctx, almacen } = nuevoContexto();
    const antes = movimientos(almacen, folio).length;
    for (const accion of ["localizar", "cerrar", "reactivar", "cancelar"] as const) assert.equal((await falla(cambiarEstadoDelCaso(sesion, folio, { accion, motivo: MOTIVO }, ctx)))?.estado, 409, `${folio} ${accion}`);
    assert.equal(movimientos(almacen, folio).length, antes);
  }
});

// ---------------------------------------------------------------------------------------------------------------------- motivo
test("HU 043 y 017 · el motivo es obligatorio (reactivar y cancelar), se sanea (R34) y no pasa de 300; en localizar y cerrar se ignora", async () => {
  const { ctx, almacen } = nuevoContexto();
  for (const [folio, accion] of [[TOBY, "reactivar"], [MAX, "cancelar"]] as const) {
    const antes = movimientos(almacen, folio).length;
    for (const malo of [undefined, "", "   ", "<b></b>", "\u0007\u0008"]) {
      const e = await falla(cambiarEstadoDelCaso(ROSA, folio, { accion, motivo: malo }, ctx));
      assert.equal(e?.estado, 422, `${accion} con motivo ${JSON.stringify(malo)}`);
      assert.equal(e?.codigo, "MOTIVO_OBLIGATORIO");
    }
    assert.equal((await falla(cambiarEstadoDelCaso(ROSA, folio, { accion, motivo: "x".repeat(301) }, ctx)))?.codigo, "MOTIVO_LARGO");
    assert.equal((await falla(cambiarEstadoDelCaso(ROSA, folio, { accion, motivo: 123 }, ctx)))?.codigo, "MOTIVO_INVALIDO");
    assert.equal((await falla(cambiarEstadoDelCaso(ROSA, folio, { accion, motivo: { a: 1 } }, ctx)))?.codigo, "MOTIVO_INVALIDO");
    assert.equal(movimientos(almacen, folio).length, antes, "un motivo inválido no deja movimiento");
  }
  await reactivarCaso(ROSA, TOBY, "  <script>alert(1)</script>Lo vi bien\u0007  ", ctx);
  assert.equal(movimientos(almacen, TOBY).at(-1)!.motivo, "alert(1)Lo vi bien", "sin etiquetas ni caracteres de control, recortado");
  await cancelarCaso(ROSA, MAX, "x".repeat(300), ctx);
  assert.equal(movimientos(almacen, MAX).at(-1)!.motivo?.length, 300, "300 caracteres exactos sí se aceptan");
  // En localizar y cerrar el motivo que llegue se ignora: no queda guardado.
  await cambiarEstadoDelCaso(ROSA, LUNA, { accion: "localizar", motivo: "no debe guardarse" }, ctx);
  assert.equal(movimientos(almacen, LUNA).at(-1)!.motivo, undefined);
  await cambiarEstadoDelCaso(ROSA, LUNA, { accion: "cerrar", motivo: "tampoco" }, ctx);
  assert.equal(movimientos(almacen, LUNA).at(-1)!.motivo, undefined);
});

test("HU 042 y 043 · la acción debe ser una de las cuatro (400 ACCION_INVALIDA) y se valida DESPUÉS de la guarda: una persona ajena recibe 404, no 400", async () => {
  const { ctx } = nuevoContexto();
  for (const mala of [undefined, "", "borrar", "LOCALIZAR", 7, null, {}]) assert.equal((await falla(cambiarEstadoDelCaso(ROSA, MAX, { accion: mala }, ctx)))?.codigo, "ACCION_INVALIDA");
  assert.equal((await falla(cambiarEstadoDelCaso(LUIS, MAX, { accion: "borrar" }, ctx)))?.estado, 404);
});

// ---------------------------------------------------------------------------------------------------------------------- doble envío y concurrencia
test("Doble envío · la segunda petición del mismo cambio da 409 amable (no es idempotente) y no duplica el movimiento", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = movimientos(almacen, MAX).length;
  await marcarLocalizado(ROSA, MAX, ctx);
  const e = await falla(marcarLocalizado(ROSA, MAX, ctx));
  assert.equal(e?.estado, 409);
  assert.equal(e?.message, MENSAJE_YA_CAMBIO);
  assert.equal(movimientos(almacen, MAX).length, antes + 1);
  await reactivarCaso(ROSA, MAX, MOTIVO, ctx);
  assert.equal((await falla(reactivarCaso(ROSA, MAX, MOTIVO, ctx)))?.estado, 409);
  assert.equal(movimientos(almacen, MAX).length, antes + 2);
});

test("Concurrencia · 25 peticiones simultáneas de localizar: exactamente UNA tiene éxito, 24 dan 409 y el historial suma un solo movimiento con consecutivo continuo", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = movimientos(almacen, MAX).length;
  const resultados = await Promise.allSettled(Array.from({ length: 25 }, () => marcarLocalizado(ROSA, MAX, ctx)));
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason as ErrorApp);
  assert.equal(rechazos.length, 24);
  assert.ok(rechazos.every((e) => e.estado === 409 && e.codigo === "TRANSICION_INVALIDA"));
  const m = movimientos(almacen, MAX);
  assert.equal(m.length, antes + 1);
  assert.deepEqual(m.map((x) => x.consecutivo), Array.from({ length: m.length }, (_, i) => i + 1), "sin huecos ni duplicados (R4)");
});

test("Concurrencia · localizar y cancelar (o cerrar y reactivar) al mismo tiempo: gana UNA y la otra ve el estado nuevo", async () => {
  const a = nuevoContexto();
  const r1 = await Promise.allSettled([marcarLocalizado(ROSA, MAX, a.ctx), cancelarCaso(ROSA, MAX, MOTIVO, a.ctx)]);
  assert.equal(r1.filter((r) => r.status === "fulfilled").length, 1);
  const estadoFinal = await estadoDe(a.ctx, MAX);
  assert.ok(estadoFinal === "Localizado" || estadoFinal === "Cerrado");
  assert.equal(movimientos(a.almacen, MAX).length, 3);
  const b = nuevoContexto();
  const r2 = await Promise.allSettled([cerrarCaso(ROSA, TOBY, b.ctx), reactivarCaso(ROSA, TOBY, MOTIVO, b.ctx), reactivarCaso(ROSA, TOBY, MOTIVO, b.ctx), cerrarCaso(ROSA, TOBY, b.ctx)]);
  assert.equal(r2.filter((r) => r.status === "fulfilled").length, 1, "desde Localizado solo una de las acciones llega a aplicarse");
  assert.equal(movimientos(b.almacen, TOBY).length, 6);
});

test("Rollback · si la matriz rechaza el movimiento no queda nada a medias: ni historial ni estado del caso cambian", async () => {
  const { ctx, almacen } = nuevoContexto();
  const caso = almacen.casos.find((c) => c.folio === TOBY)!;
  const [idEstado, fecha, n] = [caso.idEstadoCaso, caso.fechaUltimaModificacion, movimientos(almacen, TOBY).length];
  await falla(cambiarEstadoDelCaso(ROSA, TOBY, { accion: "reactivar" }, ctx)); // sin motivo
  await falla(cambiarEstadoDelCaso(ROSA, TOBY, { accion: "localizar" }, ctx)); // ya Localizado
  assert.deepEqual([caso.idEstadoCaso, caso.fechaUltimaModificacion, movimientos(almacen, TOBY).length], [idEstado, fecha, n]);
});

// ---------------------------------------------------------------------------------------------------------------------- propiedad (R32)
test("R32 · caso ajeno, inexistente y folio mal formado dan el MISMO 404 (byte por byte) para cada acción; el Administrador 403; sin sesión 401", async () => {
  const { ctx } = nuevoContexto();
  for (const accion of ["localizar", "cerrar", "reactivar", "cancelar"] as const) {
    const huellas = await Promise.all([MAX, "RUPE-ZZZZZZZZ", "mal-formado", "", "RUPE-123", "rupe-zzzzzzzz"].map(async (f) => {
      const e = await falla(cambiarEstadoDelCaso(LUIS, f, { accion, motivo: MOTIVO }, ctx)); // MAX es de Rosa: ajeno para Luis
      assert.equal(e?.estado, 404, `${accion} ${f}`);
      return huella(e!);
    }));
    assert.equal(new Set(huellas).size, 1, `${accion}: los 404 son idénticos`);
    assert.equal((await falla(cambiarEstadoDelCaso(ADMIN, MAX, { accion, motivo: MOTIVO }, ctx)))?.estado, 403);
    assert.equal((await falla(cambiarEstadoDelCaso(undefined, MAX, { accion, motivo: MOTIVO }, ctx)))?.estado, 401);
  }
  // La dueña se toma de la sesión: el folio en minúsculas funciona para ella.
  assert.equal((await marcarLocalizado(ROSA, MAX.toLowerCase(), ctx)).folio, MAX);
});

test("R32 · ninguna acción de una persona ajena cambia nada (ni estado, ni historial, ni QR)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const [h, e] = [almacen.historial.length, JSON.stringify(almacen.casos)];
  for (const accion of ["localizar", "cerrar", "reactivar", "cancelar"] as const) await falla(cambiarEstadoDelCaso(LUIS, MAX, { accion, motivo: MOTIVO }, ctx));
  assert.deepEqual([almacen.historial.length, JSON.stringify(almacen.casos)], [h, e]);
});

// ---------------------------------------------------------------------------------------------------------------------- efectos: QR, R13, R33, notificaciones, bitácora
test("R13 y QR · al localizar el caso deja de aceptar avistamientos (409) y el token del QR NO cambia; al reactivar el MISMO token vuelve a admitirlos", async () => {
  const { ctx, almacen } = nuevoContexto();
  const caso = almacen.casos.find((c) => c.folio === MAX)!;
  const token = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  const qrAntes = JSON.stringify(almacen.qr);
  await marcarLocalizado(ROSA, MAX, ctx);
  assert.equal((await falla(registrarAvistamiento({ canal: "folio", folio: MAX }, { datos: datos(), foto: FOTO }, ctx)))?.estado, 409);
  assert.equal((await falla(registrarAvistamiento({ canal: "qr", token }, { datos: datos(), foto: FOTO }, ctx)))?.estado, 409, "el QR sigue vigente pero el caso no admite avistamientos (R13)");
  assert.equal((await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico, token);
  await reactivarCaso(ROSA, MAX, MOTIVO, ctx);
  assert.equal(await estadoDe(ctx, MAX), "En seguimiento");
  assert.equal((await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico, token, "el último QR sigue vigente tras reactivar");
  const r = await registrarAvistamiento({ canal: "qr", token }, { datos: datos(), foto: FOTO }, ctx);
  assert.ok(r.id > 0);
  assert.equal(await estadoDe(ctx, MAX), "Avistamiento reportado");
  assert.equal(JSON.stringify(almacen.qr), qrAntes, "ni localizar ni reactivar ni reportar tocan las filas del QR");
});

test("R33 · tras cancelar: la ficha pública, el estatus y el QR dan 404 (idéntico al de un folio inexistente); el caso aparece como Cerrado en Mis registros", async () => {
  const { ctx, almacen } = nuevoContexto();
  const token = (await ctx.repos.qr.activoDe(almacen.casos.find((c) => c.folio === MAX)!.idCasoExtravio))!.tokenPublico;
  await cancelarCaso(ROSA, MAX, MOTIVO, ctx);
  const [ficha, estatus, inexistente] = [await falla(consultarFichaPorFolio(MAX, ctx)), await falla(consultarEstatusPorFolio(MAX, ctx)), await falla(consultarEstatusPorFolio("RUPE-ZZZZZZZZ", ctx))];
  assert.equal(ficha?.estado, 404);
  assert.equal(await huella(estatus!), await huella(inexistente!));
  assert.equal((await falla(consultarFichaPorToken(token, ctx)))?.codigo, "QR_NO_VIGENTE");
  const lista = await listarCasosDelTutor(ROSA, ctx);
  assert.equal(lista.find((f) => f.folio === MAX)?.estado, "Cerrado");
});

test("R33 · tras cerrar (cierre confirmado) el estatus público dice «Cerrado» y la ficha pública da 404", async () => {
  const { ctx } = nuevoContexto();
  await cerrarCaso(ROSA, TOBY, ctx);
  assert.equal((await consultarEstatusPorFolio(TOBY, ctx)).estado, "Cerrado");
  assert.equal((await falla(consultarFichaPorFolio(TOBY, ctx)))?.estado, 404);
});

test("R24 y R25 · ningún cambio de estado crea bitácora ni notificaciones (ni envía correo)", async () => {
  let enviados = 0;
  const { ctx, almacen } = nuevoContexto();
  ctx.enviarNotificacion = async () => { enviados++; };
  const [bitacora, notificaciones] = [almacen.bitacora.length, almacen.notificaciones.length];
  await marcarLocalizado(ROSA, MAX, ctx);
  await reactivarCaso(ROSA, MAX, MOTIVO, ctx);
  await marcarLocalizado(ROSA, MAX, ctx);
  await cerrarCaso(ROSA, MAX, ctx);
  await cancelarCaso(ROSA, COCO, MOTIVO, ctx);
  assert.deepEqual([almacen.bitacora.length, almacen.notificaciones.length, enviados], [bitacora, notificaciones, 0]);
});

test("Respuesta · solo { folio, estado, fechaCambio }: ningún dato de la persona tutora ni del caso", async () => {
  const { ctx } = nuevoContexto();
  const r = await marcarLocalizado(ROSA, MAX, ctx);
  assert.deepEqual(Object.keys(r).sort(), ["estado", "fechaCambio", "folio"]);
  assert.ok(!/Rosa|rosa\.|@example|Hern|tutor|token/i.test(JSON.stringify(r)));
});

test("Asignación masiva · una acción con campos de más (estado, idUsuario, tipo, fecha) solo usa la acción y el motivo", async () => {
  const { ctx, almacen } = nuevoContexto();
  const ataque = { accion: "localizar", estado: "Cerrado", tipoMovimiento: "deshabilitación", idUsuario: 1, fechaHora: "2000-01-01T00:00:00Z", idEstadoCaso: 6, consecutivo: 99 } as Record<string, unknown>;
  const r = await cambiarEstadoDelCaso(ROSA, MAX, ataque, ctx);
  const ult = movimientos(almacen, MAX).at(-1)!;
  assert.deepEqual([r.estado, ult.tipoMovimiento, ult.idUsuario, ult.fechaHora, ult.consecutivo], ["Localizado", "localización", 2, AHORA.toISOString(), 3]);
});

test("HU 014 · `fechaUltimaModificacion` es la fecha de EDICIÓN: ningún cambio de estado (localizar, cerrar, reactivar, cancelar, avistamiento recibido o revisado) la mueve; su fecha vive en el historial", async () => {
  const { ctx, almacen } = nuevoContexto(undefined, () => new Date("2026-10-20T15:00:00Z"));
  const fecha = (f: string) => almacen.casos.find((c) => c.folio === f)!.fechaUltimaModificacion;
  const antes = Object.fromEntries([MAX, TOBY, LUNA, COCO].map((f) => [f, fecha(f)]));
  await marcarLocalizado(ROSA, MAX, ctx);
  await reactivarCaso(ROSA, MAX, MOTIVO, ctx);
  await registrarAvistamiento({ canal: "folio", folio: MAX }, { datos: datos(), foto: FOTO }, ctx); // «avistamiento recibido»
  await marcarLocalizado(ROSA, MAX, ctx);
  await cerrarCaso(ROSA, MAX, ctx);
  await reactivarCaso(ROSA, TOBY, MOTIVO, ctx);
  await cancelarCaso(ROSA, COCO, MOTIVO, ctx);
  await abrirAvistamiento(ROSA, LUNA, "201", ctx); // «avistamiento revisado»
  for (const f of [MAX, TOBY, LUNA, COCO]) assert.equal(fecha(f), antes[f], `${f}: la fecha de edición no cambia`);
  assert.equal(movimientos(almacen, MAX).at(-1)!.fechaHora, "2026-10-20T15:00:00.000Z", "el cambio sí queda fechado en el historial");
});
