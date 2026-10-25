// Comprueba, DESPUÉS de `next build`, que ningún archivo que viaja al navegador (.next/static) contiene nombres de variables de entorno del servidor
// (RUPE_…) ni código del almacén en memoria, de las credenciales o de la sesión. Uso: npm run verificar-secretos (requiere el build hecho).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), ".next", "static");
const PROHIBIDOS: { patron: RegExp; porQue: string }[] = [
  { patron: /RUPE_[A-Z0-9_]{3,}/, porQue: "nombre de variable de entorno del servidor (RUPE_SESION_SECRETO, contraseñas, RUPE_PERMITIR_REINICIO…)" },
  { patron: /__RUPE_ALMACEN__/, porQue: "singleton del almacén en memoria" },
  { patron: /contrasenaHash|tokenHash|intentosFallidos|bloqueadoHasta/, porQue: "columnas de usuarios y sesiones (solo existen en el servidor)" },
  { patron: /crearRepositorios|reiniciarAlmacen|obtenerAlmacen|siguienteId/, porQue: "código del almacén y de los repositorios" },
  { patron: /\bhashSync\b|\bbcryptjs\b|createHmac|timingSafeEqual/, porQue: "código de contraseñas y firma de sesión" },
];

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
  for (const { patron, porQue } of PROHIBIDOS) {
    const m = texto.match(patron);
    if (m) hallazgos.push(`${f.replace(process.cwd() + "/", "")}: «${m[0]}» (${porQue})`);
  }
}
if (hallazgos.length) {
  console.log(`✗ ${hallazgos.length} hallazgo(s) en el código que viaja al navegador:\n  ${hallazgos.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ ${lista.length} archivos de .next/static revisados: ningún nombre de variable de entorno sensible ni código del almacén, de credenciales o de sesión`);
