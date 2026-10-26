import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { AHORA, nuevoContexto, secretoAleatorio } from "../pruebas/auxiliares";
import { CUENTAS_CON_CREDENCIAL } from "../seed/seed";
import { cerrarSesion, cerrarTodasLasSesiones, hashDeToken, iniciarSesion, sesionDeCookie } from "./autenticacion";
import { compararContrasena } from "./contrasenas";
import { verificar } from "./firma";

const secreto = secretoAleatorio();
const contrasenas = { admin: secretoAleatorio(), tutor1: secretoAleatorio(), tutor2: secretoAleatorio() };
const entorno = { RUPE_ADMIN_CONTRASENA: contrasenas.admin, RUPE_TUTOR1_CONTRASENA: contrasenas.tutor1, RUPE_TUTOR2_CONTRASENA: contrasenas.tutor2 };
const rechaza = (p: Promise<unknown>, estado: number, codigo: string) => assert.rejects(p, (e) => e instanceof ErrorApp && e.estado === estado && e.codigo === codigo);
const entrar = (correo: string, contrasena: string, extra: { aceptarAviso?: boolean } = {}) => ({ correo, contrasena, ...extra });
const errorDe = async (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));

test("seed · las 3 cuentas con credencial (1 Administrador y 2 Tutor) guardan solo el hash bcrypt de lo que dicen las variables de entorno", async () => {
  const { almacen } = nuevoContexto(entorno);
  const cuentas = CUENTAS_CON_CREDENCIAL.map((c) => almacen.usuarios.find((u) => u.idUsuario === c.idUsuario)!);
  assert.deepEqual(cuentas.map((c) => c.rol), ["Administrador", "Tutor", "Tutor"]);
  for (const c of cuentas) assert.match(c.contrasenaHash!, /^\$2[aby]\$10\$/);
  assert.ok(!JSON.stringify(almacen).includes(contrasenas.admin));
  const sin = nuevoContexto({});
  assert.ok(CUENTAS_CON_CREDENCIAL.every((c) => sin.almacen.usuarios.find((u) => u.idUsuario === c.idUsuario)!.contrasenaHash === null));
  await rechaza(iniciarSesion(entrar(cuentas[0].correo, "cualquiera"), sin.ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
});

test("HU 001 · caso feliz: inicia sesión sin distinguir mayúsculas del correo; la cookie devuelve la sesión", async () => {
  const { ctx } = nuevoContexto(entorno);
  const admin = (await ctx.repos.usuarios.porId(1))!;
  const a = await iniciarSesion(entrar(admin.correo.toUpperCase(), contrasenas.admin), ctx, secreto);
  assert.equal(a.sesion.rol, "Administrador");
  assert.equal(a.maxAge, 28800);
  assert.deepEqual(await sesionDeCookie(a.valorCookie, ctx, secreto), a.sesion);
});

test("R18 · cada inicio de sesión genera un identificador NUEVO; cerrar sesión invalida ese sid en el almacén y solo ese", async () => {
  const { ctx, almacen } = nuevoContexto(entorno);
  const admin = (await ctx.repos.usuarios.porId(1))!;
  const a = await iniciarSesion(entrar(admin.correo, contrasenas.admin), ctx, secreto);
  const b = await iniciarSesion(entrar(admin.correo, contrasenas.admin), ctx, secreto); // varias sesiones a la vez
  const sidA = verificar(a.valorCookie, secreto, 1)!.sid;
  const sidB = verificar(b.valorCookie, secreto, 1)!.sid;
  assert.notEqual(sidA, sidB);
  assert.equal(almacen.sesiones.length, 2);
  assert.ok(almacen.sesiones.every((s) => s.fechaCierre === null));
  await cerrarSesion(a.valorCookie, ctx, secreto);
  const reg = (sid: string) => almacen.sesiones.find((s) => s.tokenHash === hashDeToken(sid))!;
  assert.ok(reg(sidA).fechaCierre); // el sid de A quedó invalidado en el almacén
  assert.equal(reg(sidB).fechaCierre, null); // la otra sesión sigue abierta (HU 007)
  assert.equal(await sesionDeCookie(a.valorCookie, ctx, secreto), undefined);
  assert.ok(await sesionDeCookie(b.valorCookie, ctx, secreto));
  assert.ok(!JSON.stringify(almacen.sesiones).includes(sidA)); // solo se guarda el hash
});

test("HU 001 · rechazo: contraseña incorrecta, cuenta inexistente y cuenta sin credencial dan el MISMO 401 (código, mensaje y forma)", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const sinCredencial = (await ctx.repos.usuarios.porId(6))!; // sembrada sin contraseña
  const errores = [await errorDe(iniciarSesion(entrar(tutor.correo, "incorrecta1"), ctx, secreto)), await errorDe(iniciarSesion(entrar("nadie@example.org", "incorrecta1"), ctx, secreto)), await errorDe(iniciarSesion(entrar(sinCredencial.correo, "incorrecta1"), ctx, secreto))];
  assert.ok(errores.every((e) => e?.estado === 401 && e.codigo === "CREDENCIALES_INVALIDAS"));
  assert.equal(new Set(errores.map((e) => JSON.stringify([e!.estado, e!.codigo, e!.message, e!.regla, e!.campos, e!.extra]))).size, 1);
});

test("HU 001 · el costo de verificar se paga también con una cuenta inexistente (bcrypt se invoca siempre, contra un hash señuelo)", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const llamadas: string[] = [];
  const espia = { ...ctx, comparar: async (c: string, h: string) => (llamadas.push(h.slice(0, 7)), compararContrasena(c, h)) };
  await errorDe(iniciarSesion(entrar("nadie@example.org", "incorrecta1"), espia, secreto));
  await errorDe(iniciarSesion(entrar(tutor.correo, "incorrecta1"), espia, secreto));
  assert.equal(llamadas.length, 2);
  assert.deepEqual(llamadas, [llamadas[1], llamadas[1]]); // mismo algoritmo y mismo costo ($2b$10$)
  assert.match(llamadas[0], /^\$2[aby]\$10/);
});

test("HU 008 · una cuenta deshabilitada solo se revela con la contraseña correcta; con una incorrecta, el 401 uniforme", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  await ctx.repos.usuarios.guardar({ ...tutor, estatus: 0 });
  await rechaza(iniciarSesion(entrar(tutor.correo, "incorrecta1"), ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  await rechaza(iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto), 403, "CUENTA_DESHABILITADA");
});

test("R17 · el 5.º intento fallido bloquea 15 minutos (aun con la contraseña correcta) y el bloqueo vence con el reloj", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(5))!;
  for (let i = 0; i < 4; i++) await rechaza(iniciarSesion(entrar(tutor.correo, "mal"), ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  await rechaza(iniciarSesion(entrar(tutor.correo, "mal"), ctx, secreto), 403, "CUENTA_BLOQUEADA"); // el 5.º
  await rechaza(iniciarSesion(entrar(tutor.correo, contrasenas.tutor2), ctx, secreto), 403, "CUENTA_BLOQUEADA");
  const en = (min: number) => ({ ...ctx, reloj: () => new Date(AHORA.getTime() + min * 60_000) });
  await rechaza(iniciarSesion(entrar(tutor.correo, contrasenas.tutor2), en(14.9), secreto), 403, "CUENTA_BLOQUEADA");
  assert.ok((await iniciarSesion(entrar(tutor.correo, contrasenas.tutor2), en(15.1), secreto)).valorCookie);
  assert.equal((await ctx.repos.usuarios.porId(5))!.intentosFallidos, 0);
});

test("R17 · un inicio correcto reinicia el contador; los fallos intercalados no suman", async () => {
  const { ctx } = nuevoContexto(entorno);
  const t = (await ctx.repos.usuarios.porId(5))!;
  for (let i = 0; i < 3; i++) await errorDe(iniciarSesion(entrar(t.correo, "mal"), ctx, secreto));
  await iniciarSesion(entrar(t.correo, contrasenas.tutor2), ctx, secreto);
  for (let i = 0; i < 4; i++) await rechaza(iniciarSesion(entrar(t.correo, "mal"), ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  assert.ok((await iniciarSesion(entrar(t.correo, contrasenas.tutor2), ctx, secreto)).valorCookie);
});

test("R17 · un correo SIN cuenta también se bloquea igual (el bloqueo no delata si la cuenta existe)", async () => {
  const { ctx } = nuevoContexto(entorno);
  for (let i = 0; i < 4; i++) await rechaza(iniciarSesion(entrar("fantasma@example.org", "mal"), ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  const e = await errorDe(iniciarSesion(entrar("FANTASMA@example.org", "mal"), ctx, secreto));
  assert.equal(e?.estado, 403);
  assert.equal(e?.codigo, "CUENTA_BLOQUEADA");
  await rechaza(iniciarSesion(entrar("fantasma@example.org", "mal"), ctx, secreto), 403, "CUENTA_BLOQUEADA");
});

test("R22 · aviso desactualizado: 401 uniforme con contraseña incorrecta; con la correcta, 409 SIN sesión; aceptándolo, registra la aceptación y entra", async () => {
  const { ctx, almacen } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  await ctx.repos.parametros.actualizar("version_aviso_privacidad", "2.0");
  // Contraseña incorrecta: nunca se llega a saber del aviso (no sirve para saber si la cuenta existe).
  const mala = await errorDe(iniciarSesion(entrar(tutor.correo, "incorrecta1"), ctx, secreto));
  const inexistente = await errorDe(iniciarSesion(entrar("nadie@example.org", "incorrecta1"), ctx, secreto));
  assert.equal(mala?.codigo, "CREDENCIALES_INVALIDAS");
  assert.equal(JSON.stringify([mala!.estado, mala!.codigo, mala!.message]), JSON.stringify([inexistente!.estado, inexistente!.codigo, inexistente!.message]));
  // Contraseña correcta sin aceptar: 409 con la versión vigente y ninguna sesión creada.
  const e = await errorDe(iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto));
  assert.equal(e?.estado, 409);
  assert.equal(e?.codigo, "AVISO_DESACTUALIZADO");
  assert.equal(e?.regla, "R22");
  assert.deepEqual(e?.extra, { versionAviso: "2.0" });
  assert.equal(almacen.sesiones.length, 0);
  // Aceptándolo: queda la aceptación de la versión nueva (trazabilidad de versión y fecha) y se abre la sesión.
  const ok = await iniciarSesion(entrar(tutor.correo, contrasenas.tutor1, { aceptarAviso: true }), ctx, secreto);
  assert.ok(ok.valorCookie);
  const ultima = (await ctx.repos.aceptaciones.ultimaDe(2))!;
  assert.equal(ultima.versionAviso, "2.0");
  assert.equal(ultima.fechaHora, AHORA.toISOString());
  assert.equal((await ctx.repos.aceptaciones.deUsuario(2)).length, 2);
  // Y la siguiente vez ya no se pide.
  assert.ok((await iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto)).valorCookie);
});

test("R22 · la comparación es POR VALOR («1.0» y «1.00» son versiones distintas) y se toma la última aceptación (fecha, desempate por id)", async () => {
  const { ctx } = nuevoContexto(entorno);
  const t = (await ctx.repos.usuarios.porId(2))!;
  await ctx.repos.parametros.actualizar("version_aviso_privacidad", "1.00");
  await rechaza(iniciarSesion(entrar(t.correo, contrasenas.tutor1), ctx, secreto), 409, "AVISO_DESACTUALIZADO");
  // Dos aceptaciones con la misma fecha: gana la de mayor id.
  await ctx.repos.aceptaciones.agregar({ versionAviso: "0.9", fechaHora: AHORA.toISOString(), idUsuario: 2 });
  await ctx.repos.aceptaciones.agregar({ versionAviso: "1.00", fechaHora: AHORA.toISOString(), idUsuario: 2 });
  assert.equal((await ctx.repos.aceptaciones.ultimaDe(2))!.versionAviso, "1.00");
  assert.ok((await iniciarSesion(entrar(t.correo, contrasenas.tutor1), ctx, secreto)).valorCookie);
});

test("R19 · deshabilitar a la persona usuaria cierra todas sus sesiones; una sesión de un usuario inactivo no es válida", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const s1 = await iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto);
  const s2 = await iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto);
  assert.equal(await cerrarTodasLasSesiones(2, ctx), 2);
  assert.equal(await sesionDeCookie(s1.valorCookie, ctx, secreto), undefined);
  assert.equal(await sesionDeCookie(s2.valorCookie, ctx, secreto), undefined);
  const s3 = await iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto);
  await ctx.repos.usuarios.guardar({ ...tutor, estatus: 0 });
  assert.equal(await sesionDeCookie(s3.valorCookie, ctx, secreto), undefined);
});

test("R18 · la sesión expira a las 8 horas y una cookie de otro secreto no sirve", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const s = await iniciarSesion(entrar(tutor.correo, contrasenas.tutor1), ctx, secreto);
  const en = (h: number) => ({ ...ctx, reloj: () => new Date(AHORA.getTime() + h * 3_600_000) });
  assert.ok(await sesionDeCookie(s.valorCookie, en(7.9), secreto));
  assert.equal(await sesionDeCookie(s.valorCookie, en(8.1), secreto), undefined);
  assert.equal(await sesionDeCookie(s.valorCookie, ctx, secretoAleatorio()), undefined);
});
