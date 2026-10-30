import assert from "node:assert/strict";
import { test } from "node:test";
import { neutralizar } from "./neutralizar";

test("neutralizar · un texto que empieza con = + - @ (o con tabulador, retorno o espacios antes) recibe un apóstrofo; el resto queda igual", () => {
  for (const peligroso of ["=1+1", "+SUMA(1;1)", "-2+3", "@cmd", "\t=1", "\r=1", "  =HYPERLINK(\"x\")", "\n+1", "=cmd|' /C calc'!A0"]) assert.equal(neutralizar(peligroso), `'${peligroso}`, JSON.stringify(peligroso));
  for (const seguro of ["Coyoacán", "Álvaro Obregón", "Casos 2026", "a=b", "x+y", "1 - 2", "", "Estado: -2", "'=ya con apóstrofo?"]) assert.equal(neutralizar(seguro), seguro, JSON.stringify(seguro));
});
