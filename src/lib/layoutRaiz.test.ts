import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// React 19 (modo desarrollo) avisa «Encountered a script tag while rendering React component» cuando el layout raíz se vuelve a renderizar en el cliente
// (404, 403, recuperación de hidratación) y contiene un ELEMENTO <script>. El script del tema va como cadena HTML (div hidden con dangerouslySetInnerHTML);
// next/script beforeInteractive no sirve porque se ejecuta tras el primer pintado y parpadea el tema.
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const jsx = layout.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/`[^`]*`/g, "``");

test("el layout raíz no usa un elemento <script> de React ni next/script", () => {
  assert.doesNotMatch(jsx, /<script[\s>]/i);
  assert.doesNotMatch(jsx, /<Script[\s>]/);
  assert.doesNotMatch(layout, /from "next\/script"/);
});

test("el script del tema inicial sigue en el layout, antes del contenido, como cadena HTML", () => {
  assert.match(layout, /dangerouslySetInnerHTML=\{\{ __html: `<script>\$\{SCRIPT_TEMA_INICIAL\}<\/script>` \}\}/);
  assert.ok(layout.indexOf("SCRIPT_TEMA_INICIAL}</script>") < layout.indexOf("{children}"));
});

test("ImagenPrincipal tampoco usa un elemento <script> de React: su script de carga por tema va como cadena HTML", () => {
  const fuente = readFileSync(new URL("../components/features/ImagenPrincipal.tsx", import.meta.url), "utf8");
  const sinComentarios = fuente.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/`[^`]*`/g, "``");
  assert.doesNotMatch(sinComentarios, /<script[\s>]/i);
  assert.doesNotMatch(fuente, /from "next\/script"/);
  assert.match(fuente, /dangerouslySetInnerHTML=\{\{ __html: `<script>\$\{SCRIPT_CARGA_PORTADA\}<\/script>` \}\}/);
});
