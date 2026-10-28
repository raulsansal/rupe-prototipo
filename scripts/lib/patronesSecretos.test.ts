import assert from "node:assert/strict";
import { test } from "node:test";
import { hallazgosEn, NOMBRE_EXCEPTUADO } from "./patronesSecretos";

const detecta = (t: string) => hallazgosEn(t).length > 0;

test("verificar-secretos · la excepción es EXACTA: solo el nombre RUPE_URL_PUBLICA, citado en el aviso, pasa", () => {
  assert.equal(NOMBRE_EXCEPTUADO, "RUPE_URL_PUBLICA");
  assert.equal(detecta("Configura RUPE_URL_PUBLICA para generar el QR."), false);
  assert.equal(detecta('"Configura RUPE_URL_PUBLICA para generar el QR."'), false);
  assert.equal(detecta("RUPE_URL_PUBLICA"), false);
});

test("verificar-secretos · un nombre parecido o con valor SIGUE detectándose", () => {
  for (const malo of [
    "RUPE_URL_PUBLICA_SECRETO", "RUPE_URL_PUBLICA2", "RUPE_URL_PUBLICAS", "RUPE_URL_PUBLICA_", "RUPE_URL_PRIVADA", "RUPE_URL", "RUPE_URL_PUBLIC",
    "RUPE_URL_PUBLICA=https://x.example", "RUPE_URL_PUBLICA = https://x.example", 'RUPE_URL_PUBLICA: "https://x.example"', "RUPE_URL_PUBLICA='abc'",
    "process.env.RUPE_URL_PUBLICA", "x=process.env.RUPE_URL_PUBLICA||1",
  ]) assert.equal(detecta(malo), true, malo);
});

test("verificar-secretos · el resto de los RUPE_… y del código de servidor sigue prohibido, aunque aparezca junto a la excepción", () => {
  for (const malo of ["RUPE_SESION_SECRETO", "RUPE_PERMITIR_REINICIO", "RUPE_ADMIN_CONTRASENA", "RUPE_TUTOR1_CORREO", "__RUPE_ALMACEN__", "contrasenaHash", "obtenerAlmacen", "createHmac"]) assert.equal(detecta(malo), true, malo);
  assert.equal(detecta("Configura RUPE_URL_PUBLICA para generar el QR. Y además RUPE_SESION_SECRETO"), true);
  assert.equal(detecta("RUPE_SESION_SECRETO y luego Configura RUPE_URL_PUBLICA"), true);
});
