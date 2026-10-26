// npm run preparar-fotos [-- --portada] [--origen=carpeta] [--salida=carpeta]
// Sin opciones: lee fotos-originales/<FOLIO>.{jpg,png,webp} (un archivo por caso sembrado) y escribe src/server/seed/fotos/<FOLIO>.jpg (JPEG, lado máx. 1600 px, sin metadatos).
// Con --portada: lee fotos-originales/portada-{claro,oscuro}.{jpg,png,webp} y escribe public/portada/portada-{claro,oscuro}.jpg (ancho máx. 2520 px, ≈ ≤ 350 KB).
// Nunca amplía. Después de escribir relee cada resultado y comprueba que es JPEG, sin EXIF y dentro del límite; imprime una tabla y termina con error si algo falla.
// Las imágenes finales y fotos-originales/ no se agregan a git desde aquí (los originales están en .gitignore).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { CASOS_MODERACION } from "../src/mocks/moderacion";
import { ANCHO_MAXIMO_PORTADA, LADO_MAXIMO_CASO, prepararImagen, verificarResultado } from "./lib/prepararFoto";

const arg = (nombre: string) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");
const portada = process.argv.includes("--portada");
const origen = arg("origen") ?? "fotos-originales";
const salida = arg("salida") ?? (portada ? "public/portada" : "src/server/seed/fotos");
const EXTENSIONES = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const PESO_MAXIMO_PORTADA = 350 * 1024;
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

const avisos: string[] = [];
const filas: string[][] = [["archivo", "original", "final", "verificación"]];
let errores = 0;

/** «RUPE-N8D5GX3W..png» → «RUPE-N8D5GX3W» (puntos de más antes de la extensión): se normaliza y se avisa. */
function nombreBase(archivo: string): string {
  const base = basename(archivo, extname(archivo));
  const limpio = base.replace(/\.+$/, "");
  if (limpio !== base) avisos.push(`«${archivo}»: el nombre tiene puntos de más; se usa «${limpio}». Conviene renombrarlo.`);
  return limpio;
}

async function procesar(archivo: string, destino: string, limite: Parameters<typeof prepararImagen>[1], opciones: Parameters<typeof prepararImagen>[2], tope: (v: Awaited<ReturnType<typeof verificarResultado>>) => boolean) {
  const bytes = readFileSync(join(origen, archivo));
  try {
    const meta = await verificarResultado(bytes).catch(() => ({ ancho: 0, alto: 0 }));
    const r = await prepararImagen(bytes, limite, opciones);
    mkdirSync(salida, { recursive: true });
    writeFileSync(join(salida, destino), r.bytes);
    const v = await verificarResultado(readFileSync(join(salida, destino)));
    const ok = v.esJpeg && v.sinExif && tope(v) && (!opciones?.pesoMaximo || r.bytes.length <= opciones.pesoMaximo);
    if (!ok) errores++;
    filas.push([archivo, `${meta.ancho}×${meta.alto} px, ${kb(bytes.length)}`, `${destino}: ${v.ancho}×${v.alto} px, ${kb(r.bytes.length)}`, ok ? "JPEG, sin EXIF, dentro del límite" : `FALLA (jpeg=${v.esJpeg}, sinExif=${v.sinExif}, lado=${v.lado}, ${kb(r.bytes.length)})`]);
  } catch (e) {
    errores++;
    filas.push([archivo, `${kb(bytes.length)}`, "—", `ERROR: ${e instanceof Error ? e.message : String(e)}`]);
  }
}

async function main() {
  if (!existsSync(origen)) throw new Error(`No existe la carpeta de originales «${origen}».`);
  const archivos = readdirSync(origen).filter((a) => !a.startsWith(".") && EXTENSIONES.has(extname(a).toLowerCase()) && statSync(join(origen, a)).isFile()).sort();
  if (portada) {
    for (const tema of ["claro", "oscuro"]) {
      const a = archivos.find((x) => nombreBase(x) === `portada-${tema}`);
      if (!a) {
        avisos.push(`falta «portada-${tema}» (jpg, png o webp) en ${origen}/`);
        errores++;
        continue;
      }
      await procesar(a, `portada-${tema}.jpg`, { tipo: "ancho", maximo: ANCHO_MAXIMO_PORTADA }, { calidad: 82, pesoMaximo: PESO_MAXIMO_PORTADA }, (v) => v.ancho <= ANCHO_MAXIMO_PORTADA);
    }
  } else {
    const folios = new Set<string>(CASOS_MODERACION.map((c) => c.folio));
    const vistos = new Set<string>();
    for (const a of archivos) {
      const folio = nombreBase(a);
      if (/^portada-/.test(folio)) continue; // son de --portada
      if (!folios.has(folio)) {
        avisos.push(`«${a}»: «${folio}» no es el folio de ningún caso sembrado; se omite.`);
        continue;
      }
      if (vistos.has(folio)) {
        avisos.push(`«${a}»: el folio ${folio} ya tiene otro original; se omite.`);
        continue;
      }
      vistos.add(folio);
      await procesar(a, `${folio}.jpg`, { tipo: "lado", maximo: LADO_MAXIMO_CASO }, {}, (v) => v.lado <= LADO_MAXIMO_CASO);
    }
    for (const f of [...folios].sort()) if (!vistos.has(f)) avisos.push(`falta el original del caso ${f} (${CASOS_MODERACION.find((c) => c.folio === f)!.nombre}); conserva su imagen de marcador.`);
  }
  const anchos = filas[0].map((_, i) => Math.max(...filas.map((f) => f[i].length)));
  for (const f of filas) console.log(f.map((c, i) => c.padEnd(anchos[i])).join("  "));
  if (avisos.length) console.log(`\nAvisos:\n${avisos.map((a) => `  · ${a}`).join("\n")}`);
  const hechos = filas.length - 1;
  console.log(errores ? `\n${errores} problema(s): revisa la tabla.` : `\nOK: ${hechos} imagen(es) preparada(s) en ${salida}/ (JPEG, sin metadatos).`);
  process.exit(errores ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
