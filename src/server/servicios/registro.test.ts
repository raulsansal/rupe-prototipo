import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { AHORA, nuevoContexto, secretoAleatorio } from "../pruebas/auxiliares";
import { bytesDe, errorDePoliticaDeContrasena } from "../sesion/contrasenas";
import { sesionDeCookie } from "../sesion/autenticacion";
import { leerDatosDeRegistro, registrarTutor } from "./registro";

const secreto = secretoAleatorio();
const contrasena = `${secretoAleatorio().slice(0, 10)}a1`; // aleatoria en cada corrida, con letras y números
const valido = (extra: Record<string, unknown> = {}) => ({ nombre: "Nube Prueba Ficticia", correo: "nube.prueba@example.org", contrasena, telefono: "5512345678", aceptaAviso: true, versionAviso: "1.0", ...extra });
const falla = async (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));

test("HU 002 · caso feliz: crea la persona (rol Tutor, activa, notificaciones activas), su aceptación v1.0 y abre la sesión (R5)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const r = await registrarTutor(valido(), ctx, secreto);
  const u = (await ctx.repos.usuarios.porCorreo("nube.prueba@example.org"))!;
  assert.deepEqual([u.rol, u.estatus, u.notificacionesActivas, u.intentosFallidos, u.bloqueadoHasta], ["Tutor", 1, true, 0, null]);
  assert.equal(u.fechaRegistro, AHORA.toISOString());
  assert.equal(u.fechaUltimaModificacion, u.fechaRegistro);
  assert.match(u.contrasenaHash!, /^\$2[aby]\$10\$/);
  assert.ok(!JSON.stringify(almacen).includes(contrasena)); // solo el hash
  const acept = await ctx.repos.aceptaciones.deUsuario(u.idUsuario);
  assert.deepEqual(acept.map((a) => [a.versionAviso, a.fechaHora]), [["1.0", AHORA.toISOString()]]);
  assert.deepEqual(await sesionDeCookie(r.valorCookie, ctx, secreto), { idUsuario: u.idUsuario, rol: "Tutor", nombre: "Nube Prueba Ficticia" });
});

test("HU 003 · rechazo: sin aceptar el aviso no se guarda NADA (ni usuario ni aceptación)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const usuarios = almacen.usuarios.length;
  const aceptaciones = almacen.aceptaciones.length;
  for (const v of [{ aceptaAviso: false }, { aceptaAviso: "true" }, { aceptaAviso: undefined }]) {
    const e = await falla(registrarTutor(valido(v), ctx, secreto));
    assert.equal(e?.estado, 422);
    assert.match(e!.campos!.aviso, /Debes aceptar el aviso de privacidad v1\.0/);
  }
  assert.equal(almacen.usuarios.length, usuarios);
  assert.equal(almacen.aceptaciones.length, aceptaciones);
  assert.equal(almacen.sesiones.length, 0);
});

test("R22 · rechazo: aceptar una versión del aviso que ya no es la vigente da 409 y no guarda nada", async () => {
  const { ctx, almacen } = nuevoContexto();
  await ctx.repos.administracion.modificarParametros({ version_aviso_privacidad: "2.0" }, { idAdministrador: 1, fecha: AHORA.toISOString() }); // vía real: transacción + bitácora
  const e = await falla(registrarTutor(valido(), ctx, secreto));
  assert.equal(e?.estado, 409);
  assert.equal(e?.codigo, "AVISO_DESACTUALIZADO");
  assert.deepEqual(e?.extra, { versionAviso: "2.0" });
  assert.equal(almacen.usuarios.length, 12);
  assert.equal((await registrarTutor(valido({ versionAviso: "2.0" }), ctx, secreto)).sesion.rol, "Tutor");
});

test("HU 002 · rechazo: correo duplicado, sin distinguir mayúsculas ni espacios, da 409 con el error en el campo", async () => {
  const { ctx, almacen } = nuevoContexto();
  const existente = (await ctx.repos.usuarios.porId(2))!.correo;
  for (const correo of [existente, existente.toUpperCase(), `  ${existente} `]) {
    const e = await falla(registrarTutor(valido({ correo }), ctx, secreto));
    assert.equal(e?.estado, 409);
    assert.equal(e?.codigo, "CORREO_DUPLICADO");
    assert.match(e!.campos!.correo, /ya está registrado/);
  }
  assert.equal(almacen.usuarios.length, 12);
  await registrarTutor(valido(), ctx, secreto);
  assert.equal((await falla(registrarTutor(valido({ correo: "NUBE.PRUEBA@EXAMPLE.ORG" }), ctx, secreto)))?.codigo, "CORREO_DUPLICADO");
});

test("R23 · rechazo: contraseña débil (corta, sin números, sin letras) con mensaje bajo el campo", async () => {
  const { ctx } = nuevoContexto();
  for (const c of ["abc1", "soloLetrasLargas", "123456789012", ""]) {
    const e = await falla(registrarTutor(valido({ contrasena: c }), ctx, secreto));
    assert.equal(e?.estado, 422);
    assert.equal(e?.campos?.contrasena, c ? "La contraseña debe tener mínimo 8 caracteres, con letras y números." : "La contraseña debe tener mínimo 8 caracteres, con letras y números.");
  }
  assert.equal(errorDePoliticaDeContrasena("Abcdefg1"), undefined); // 8 con letras y números: el mínimo exacto
  assert.equal(errorDePoliticaDeContrasena("Contraseña1"), undefined);
});

test("bcrypt · el tope de 72 se cuenta en BYTES (no en caracteres) con un mensaje claro", async () => {
  const { ctx } = nuevoContexto();
  assert.equal(errorDePoliticaDeContrasena("a1".repeat(36)), undefined); // 72 bytes exactos
  assert.match(errorDePoliticaDeContrasena("a1".repeat(36) + "b")!, /72 bytes/);
  const acentos = "á1".repeat(24) + "ab"; // 50 caracteres, pero 74 bytes
  assert.ok(acentos.length < 72 && bytesDe(acentos) > 72);
  assert.match(errorDePoliticaDeContrasena(acentos)!, /72 bytes/);
  const e = await falla(registrarTutor(valido({ contrasena: acentos }), ctx, secreto));
  assert.match(e!.campos!.contrasena, /no puede pasar de 72 bytes/);
});

test("HU 002 · rechazo: campos faltantes o inválidos devuelven TODOS los errores por campo; teléfono obligatorio (10 a 15 dígitos)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const e = await falla(registrarTutor({}, ctx, secreto));
  assert.equal(e?.estado, 422);
  assert.deepEqual(Object.keys(e!.campos!).sort(), ["aviso", "contrasena", "correo", "nombre", "telefono"]);
  assert.equal(e!.campos!.telefono, "Escribe tu teléfono de contacto.");
  for (const telefono of ["123", "55 1234 5678", "55-1234-5678", "1234567890123456", "abcdefghij"]) assert.match((await falla(registrarTutor(valido({ telefono }), ctx, secreto)))!.campos!.telefono, /10 a 15 dígitos/);
  assert.match((await falla(registrarTutor(valido({ correo: "sin-arroba" }), ctx, secreto)))!.campos!.correo, /correo válido/);
  assert.match((await falla(registrarTutor(valido({ nombre: "   " }), ctx, secreto)))!.campos!.nombre, /nombre completo/);
  assert.match((await falla(registrarTutor(valido({ nombre: "x".repeat(151) }), ctx, secreto)))!.campos!.nombre, /150/);
  assert.match((await falla(registrarTutor(valido({ correo: `${"a".repeat(250)}@b.co` }), ctx, secreto)))!.campos!.correo, /correo válido/);
  assert.equal(almacen.usuarios.length, 12);
  for (const cuerpo of [null, "texto", 7, []]) assert.equal((await falla(registrarTutor(cuerpo, ctx, secreto)))?.estado, 400);
});

test("Asignación masiva · el cliente no puede fijar rol, estatus, id, intentos, fechas ni notificaciones: se ignoran", async () => {
  const { ctx } = nuevoContexto();
  const intruso = { rol: "Administrador", idRol: 1, estatus: 0, idUsuario: 1, id: 1, intentosFallidos: 4, bloqueadoHasta: "2099-01-01T00:00:00Z", fechaRegistro: "2000-01-01T00:00:00Z", fechaUltimaModificacion: "2000-01-01T00:00:00Z", notificacionesActivas: false, contrasenaHash: "$2b$10$falso", __proto__: { rol: "Administrador" } };
  assert.deepEqual(Object.keys(leerDatosDeRegistro({ ...valido(), ...intruso })).sort(), ["aceptaAviso", "contrasena", "correo", "nombre", "telefono", "versionAviso"]);
  const r = await registrarTutor({ ...valido(), ...intruso }, ctx, secreto);
  const u = (await ctx.repos.usuarios.porCorreo("nube.prueba@example.org"))!;
  assert.notEqual(u.idUsuario, 1);
  assert.equal(r.sesion.rol, "Tutor");
  assert.deepEqual([u.rol, u.estatus, u.notificacionesActivas, u.intentosFallidos, u.bloqueadoHasta], ["Tutor", 1, true, 0, null]);
  assert.equal(u.fechaRegistro, AHORA.toISOString());
  assert.notEqual(u.contrasenaHash, "$2b$10$falso");
  assert.equal((await ctx.repos.usuarios.todos()).filter((x) => x.rol === "Administrador").length, 2); // no apareció ningún administrador nuevo
});
