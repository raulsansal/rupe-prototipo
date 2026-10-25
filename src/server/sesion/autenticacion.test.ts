import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { AHORA, nuevoContexto, secretoAleatorio } from "../pruebas/auxiliares";
import { CUENTAS_CON_CREDENCIAL } from "../seed/seed";
import { cerrarSesion, cerrarTodasLasSesiones, iniciarSesion, sesionDeCookie } from "./autenticacion";

const secreto = secretoAleatorio();
const contrasenas = { admin: secretoAleatorio(), tutor1: secretoAleatorio(), tutor2: secretoAleatorio() };
const entorno = { RUPE_ADMIN_CONTRASENA: contrasenas.admin, RUPE_TUTOR1_CONTRASENA: contrasenas.tutor1, RUPE_TUTOR2_CONTRASENA: contrasenas.tutor2 };
const rechaza = (p: Promise<unknown>, estado: number, codigo: string) => assert.rejects(p, (e) => e instanceof ErrorApp && e.estado === estado && e.codigo === codigo);

test("seed · las 3 cuentas con credencial (1 Administrador y 2 Tutor) guardan solo el hash bcrypt de lo que dicen las variables de entorno", async () => {
  const { almacen } = nuevoContexto(entorno);
  const cuentas = CUENTAS_CON_CREDENCIAL.map((c) => almacen.usuarios.find((u) => u.idUsuario === c.idUsuario)!);
  assert.deepEqual(cuentas.map((c) => c.rol), ["Administrador", "Tutor", "Tutor"]);
  for (const c of cuentas) assert.match(c.contrasenaHash!, /^\$2[aby]\$10\$/);
  assert.ok(!JSON.stringify(almacen).includes(contrasenas.admin));
  // Sin variables de entorno las cuentas existen pero sin credencial (no se puede iniciar sesión).
  const sin = nuevoContexto({});
  assert.ok(CUENTAS_CON_CREDENCIAL.every((c) => sin.almacen.usuarios.find((u) => u.idUsuario === c.idUsuario)!.contrasenaHash === null));
  await rechaza(iniciarSesion(cuentas[0].correo, "cualquiera", sin.ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
});

test("sesión · caso feliz: inicia sesión, la cookie devuelve la sesión y cerrar sesión cierra solo esa (R18)", async () => {
  const { ctx } = nuevoContexto(entorno);
  const admin = (await ctx.repos.usuarios.porId(1))!;
  const a = await iniciarSesion(admin.correo.toUpperCase(), contrasenas.admin, ctx, secreto);
  const b = await iniciarSesion(admin.correo, contrasenas.admin, ctx, secreto); // varias sesiones a la vez
  assert.equal(a.sesion.rol, "Administrador");
  assert.equal(a.maxAge, 28800);
  assert.deepEqual(await sesionDeCookie(a.valorCookie, ctx, secreto), a.sesion);
  await cerrarSesion(a.valorCookie, ctx, secreto);
  assert.equal(await sesionDeCookie(a.valorCookie, ctx, secreto), undefined);
  assert.ok(await sesionDeCookie(b.valorCookie, ctx, secreto));
});

test("sesión · rechazos: contraseña incorrecta, cuenta inexistente y cuenta deshabilitada", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  await rechaza(iniciarSesion(tutor.correo, "incorrecta", ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  await rechaza(iniciarSesion("nadie@example.org", contrasenas.tutor1, ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  await ctx.repos.usuarios.guardar({ ...tutor, estatus: 0 });
  await rechaza(iniciarSesion(tutor.correo, contrasenas.tutor1, ctx, secreto), 403, "CUENTA_DESHABILITADA");
});

test("R17 · cinco intentos fallidos bloquean la cuenta 15 minutos, aun con la contraseña correcta", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(5))!;
  for (let i = 0; i < 5; i++) await rechaza(iniciarSesion(tutor.correo, "mal", ctx, secreto), 401, "CREDENCIALES_INVALIDAS");
  await rechaza(iniciarSesion(tutor.correo, contrasenas.tutor2, ctx, secreto), 403, "CUENTA_BLOQUEADA");
  const despues = { ...ctx, reloj: () => new Date(AHORA.getTime() + 16 * 60_000) };
  assert.ok((await iniciarSesion(tutor.correo, contrasenas.tutor2, despues, secreto)).valorCookie);
});

test("R19 · deshabilitar a la persona usuaria cierra todas sus sesiones; una sesión de un usuario inactivo no es válida", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const s1 = await iniciarSesion(tutor.correo, contrasenas.tutor1, ctx, secreto);
  const s2 = await iniciarSesion(tutor.correo, contrasenas.tutor1, ctx, secreto);
  assert.equal(await cerrarTodasLasSesiones(2, ctx), 2);
  assert.equal(await sesionDeCookie(s1.valorCookie, ctx, secreto), undefined);
  assert.equal(await sesionDeCookie(s2.valorCookie, ctx, secreto), undefined);
  const s3 = await iniciarSesion(tutor.correo, contrasenas.tutor1, ctx, secreto);
  await ctx.repos.usuarios.guardar({ ...tutor, estatus: 0 });
  assert.equal(await sesionDeCookie(s3.valorCookie, ctx, secreto), undefined);
});

test("R18 · la sesión expira a las 8 horas y una cookie de otro secreto no sirve", async () => {
  const { ctx } = nuevoContexto(entorno);
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const s = await iniciarSesion(tutor.correo, contrasenas.tutor1, ctx, secreto);
  const en = (h: number) => ({ ...ctx, reloj: () => new Date(AHORA.getTime() + h * 3_600_000) });
  assert.ok(await sesionDeCookie(s.valorCookie, en(7.9), secreto));
  assert.equal(await sesionDeCookie(s.valorCookie, en(8.1), secreto), undefined);
  assert.equal(await sesionDeCookie(s.valorCookie, ctx, secretoAleatorio()), undefined);
});
