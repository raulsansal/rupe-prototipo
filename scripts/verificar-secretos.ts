// Comprueba, DESPUÉS de `next build`, que ningún archivo que viaja al navegador (.next/static) contiene nombres de variables de entorno del servidor
// (RUPE_…) ni código del almacén en memoria, de las credenciales o de la sesión. Uso: npm run verificar-secretos (requiere el build hecho).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { hallazgosEn } from "./lib/patronesSecretos";

const RAIZ = join(process.cwd(), ".next", "static");
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : /\.(js|css|html|json|map|txt)$/.test(n) ? [r] : [];
  });
}

if (!existsSync(RAIZ)) {
  console.error("No existe .next/static: ejecuta antes `npm run build`.");
  process.exit(1);
}
const lista = archivos(RAIZ);
const hallazgos: string[] = [];
for (const f of lista) {
  const texto = readFileSync(f, "utf8");
  for (const [coincidencia, porQue] of hallazgosEn(texto)) hallazgos.push(`${f.replace(process.cwd() + "/", "")}: «${coincidencia}» (${porQue})`);
}
if (hallazgos.length) {
  console.log(`✗ ${hallazgos.length} hallazgo(s) en el código que viaja al navegador:\n  ${hallazgos.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ ${lista.length} archivos de .next/static revisados: ningún nombre de variable de entorno sensible ni código del almacén, de credenciales o de sesión`);
