import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { jpeg } from "../pruebas/imagenes";
import { leerDatosDeExtravio, validarExtravio, type CatalogosDeExtravio } from "./caso";

const cat: CatalogosDeExtravio = {
  razas: [{ idRaza: 1, estatus: 1 }, { idRaza: 6, estatus: 0 }, { idRaza: 14, estatus: 1 }],
  alcaldias: [{ idAlcaldia: 4, nombre: "Coyoacán", estatus: 1 }, { idAlcaldia: 12, nombre: "Milpa Alta", estatus: 0 }, { idAlcaldia: 17, nombre: "Fuera de la Ciudad de México", estatus: 1 }],
  motivos: [{ idMotivo: 1, estatus: 1 }, { idMotivo: 2, estatus: 0 }],
};
const base = { nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", fechaExtravio: "2026-10-18", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", idMotivo: 1 };
const foto = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const valida = (extra: Record<string, unknown> = {}, hoy = "2026-10-18", f: typeof foto | null = foto) => validarExtravio(leerDatosDeExtravio({ ...base, ...extra }), cat, { hoy, foto: f ?? undefined, maximoMb: 4 });

test("HU 011 y 012 · caso feliz: datos válidos con los opcionales ausentes", () => {
  const r = valida();
  assert.deepEqual(r.campos, {});
  assert.equal(r.validado?.perro.nombre, "Pelusa");
  assert.equal(r.validado?.perro.razaEspecificada, undefined);
  assert.equal(r.validado?.caso.direccionAproximada, undefined);
  assert.equal(r.validado?.foto.formato, "JPG");
});

test("HU 011 y 012 · rechazo: cuerpo vacío devuelve TODOS los errores obligatorios, por campo y en español", () => {
  const r = validarExtravio(leerDatosDeExtravio({}), cat, { hoy: "2026-10-18", foto: undefined, maximoMb: 4 });
  assert.deepEqual(Object.keys(r.campos).sort(), ["alcaldia", "colonia", "color", "edad", "fecha", "foto", "momento", "motivo", "nombre", "raza", "sexo", "tamano"]);
  assert.equal(r.campos.nombre, "Escribe el nombre del perro.");
  assert.equal(r.campos.motivo, "Elige el motivo del extravío.");
  assert.throws(() => leerDatosDeExtravio(null), (e) => e instanceof ErrorApp && e.estado === 400);
  assert.throws(() => leerDatosDeExtravio([1]), (e) => e instanceof ErrorApp && e.estado === 400);
});

test("R8 · con «Otra» la raza especificada es obligatoria; con otra raza se descarta sin error", () => {
  assert.equal(valida({ idRaza: 14 }).campos.razaEspecificada, "Especifica la raza.");
  assert.equal(valida({ idRaza: 14, razaEspecificada: "x".repeat(51) }).campos.razaEspecificada, "No puede pasar de 50 caracteres.");
  assert.equal(valida({ idRaza: 14, razaEspecificada: " Salchicha " }).validado?.perro.razaEspecificada, "Salchicha");
  assert.equal(valida({ idRaza: 1, razaEspecificada: "Salchicha" }).validado?.perro.razaEspecificada, undefined);
  assert.equal(valida({ idRaza: "14", razaEspecificada: "Criollo" }).validado?.perro.idRaza, 14); // el identificador puede llegar como texto
});

test("HU 011 · rechazo: raza desactivada o inexistente, sexo y tamaño fuera de lista, textos largos", () => {
  for (const idRaza of [6, 99, "abc", null, 1.5]) assert.equal(valida({ idRaza }).campos.raza, "Elige la raza.", String(idRaza));
  assert.equal(valida({ sexo: "Macho " }).campos.sexo, undefined); // se recorta
  assert.equal(valida({ sexo: "Otro" }).campos.sexo, "Elige el sexo del perro.");
  assert.equal(valida({ tamano: "enorme" }).campos.tamano, "Elige el tamaño.");
  assert.match(valida({ nombre: "x".repeat(51) }).campos.nombre, /50 caracteres/);
  assert.match(valida({ color: "x".repeat(51) }).campos.color, /50 caracteres/);
  assert.match(valida({ caracteristicas: "x".repeat(301) }).campos.caracteristicas, /300 caracteres/);
  assert.equal(valida({ caracteristicas: "x".repeat(300) }).campos.caracteristicas, undefined);
});

test("HU 011 · edad: meses 0–11 (0 = menos de 1 mes) y años 1–50", () => {
  assert.equal(valida({ edad: { valor: 0, unidad: "meses" } }).validado?.perro.edadValor, 0);
  assert.equal(valida({ edad: { valor: "11", unidad: "meses" } }).validado?.perro.edadValor, 11);
  for (const edad of [{ valor: 12, unidad: "meses" }, { valor: 0, unidad: "años" }, { valor: 51, unidad: "años" }, { valor: 2.5, unidad: "años" }, {}, "3 años"]) assert.equal(valida({ edad }).campos.edad, "Elige la edad aproximada.", JSON.stringify(edad));
});

test("R10 · fecha del extravío: hoy se acepta, mañana no, y una fecha inexistente tampoco", () => {
  assert.equal(valida({ fechaExtravio: "2026-10-18" }).campos.fecha, undefined);
  assert.equal(valida({ fechaExtravio: "2026-10-19" }).campos.fecha, "La fecha del extravío no puede ser posterior a hoy.");
  assert.equal(valida({ fechaExtravio: "2026-02-30" }).campos.fecha, "La fecha del extravío no es válida.");
  assert.equal(valida({ fechaExtravio: "18/10/2026" }).campos.fecha, "La fecha del extravío no es válida.");
});

test("R14 · la alcaldía sale del catálogo activo y nunca es «Fuera de la Ciudad de México»", () => {
  for (const alcaldia of ["Fuera de la Ciudad de México", "Milpa Alta", "Gotham", "", "coyoacán"]) assert.equal(valida({ alcaldia }).campos.alcaldia, "Elige la alcaldía.", alcaldia);
  assert.equal(valida({ alcaldia: "Coyoacán" }).validado?.caso.idAlcaldia, 4);
});

test("HU 012 · momento del día, motivo único del catálogo activo y límites de los opcionales", () => {
  for (const momento of ["amanecer", "", "Tarde"]) assert.equal(valida({ momento }).campos.momento, "Elige el momento del día.", momento);
  assert.equal(valida({ momento: "desconocido" }).campos.momento, undefined);
  for (const idMotivo of [2, 99, [1, 2], null]) assert.equal(valida({ idMotivo }).campos.motivo, "Elige el motivo del extravío.", String(idMotivo));
  assert.match(valida({ calle: "x".repeat(201) }).campos.calle, /200/);
  assert.match(valida({ referencias: "x".repeat(501) }).campos.referencias, /500/);
  assert.match(valida({ descripcion: "x".repeat(1001) }).campos.descripcion, /1000/);
  assert.match(valida({ colonia: "x".repeat(101) }).campos.colonia, /100/);
  const l = valida({ calle: "x".repeat(200), referencias: "x".repeat(500), descripcion: "x".repeat(1000) });
  assert.deepEqual(l.campos, {});
});

test("HU 011 · la fotografía es obligatoria y se valida por sus bytes", () => {
  assert.match(valida({}, "2026-10-18", null).campos.foto, /obligatoria/);
  assert.equal(valida({}, "2026-10-18", { bytes: Uint8Array.from(Buffer.from("GIF89a")), tipoDeclarado: "image/jpeg" }).campos.foto, "La fotografía debe ser JPG o PNG.");
});

test("Asignación masiva · solo se leen los campos de la lista permitida", () => {
  const d = leerDatosDeExtravio({ ...base, idCaso: 7, folio: "RUPE-AAAAAAAA", estado: "Cerrado", idUsuario: 1, idPerro: 1, fechaRegistro: "2000-01-01", rol: "Administrador", id: 3, idEstadoCaso: 6 });
  assert.deepEqual(Object.keys(d).sort(), ["alcaldia", "calle", "caracteristicas", "colonia", "color", "descripcion", "edadUnidad", "edadValor", "fechaExtravio", "idMotivo", "idRaza", "momento", "nombre", "razaEspecificada", "referencias", "sexo", "tamano"]);
});
