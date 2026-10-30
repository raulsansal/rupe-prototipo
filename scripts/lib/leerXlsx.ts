// Lee un .xlsx SIN dependencias (zip con node:zlib) para comprobar, celda por celda, lo que la exportación escribió. Solo entiende lo que write-excel-file produce: textos compartidos o en línea y números.
import { inflateRawSync } from "node:zlib";

export type Celda = string | number;
export type Hoja = { nombre: string; celdas: Map<string, Celda> };

const entidades = (t: string) => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]));

/** Entradas del zip por nombre (texto UTF-8). */
export function entradasDeZip(buf: Uint8Array): Map<string, string> {
  const b = Buffer.from(buf);
  const fin = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error("No es un zip");
  const n = b.readUInt16LE(fin + 10);
  let p = b.readUInt32LE(fin + 16);
  const salida = new Map<string, string>();
  for (let i = 0; i < n; i++) {
    const metodo = b.readUInt16LE(p + 10);
    const tam = b.readUInt32LE(p + 20);
    const nl = b.readUInt16LE(p + 28);
    const el = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const desde = b.readUInt32LE(p + 42);
    const nombre = b.toString("utf8", p + 46, p + 46 + nl);
    const datos = desde + 30 + b.readUInt16LE(desde + 26) + b.readUInt16LE(desde + 28);
    const crudo = b.subarray(datos, datos + tam);
    salida.set(nombre, (metodo === 8 ? inflateRawSync(crudo) : crudo).toString("utf8"));
    p += 46 + nl + el + cl;
  }
  return salida;
}

export function leerXlsx(buf: Uint8Array): Hoja[] {
  const e = entradasDeZip(buf);
  const compartidos = [...(e.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => entidades([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const libro = e.get("xl/workbook.xml") ?? "";
  const rels = new Map([...(e.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])![1], /Target="([^"]+)"/.exec(m[0])![1]]));
  return [...libro.matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const nombre = entidades(/name="([^"]*)"/.exec(m[0])![1]);
    const destino = rels.get(/r:id="([^"]+)"/.exec(m[0])![1])!.replace(/^\/?(xl\/)?/, "xl/");
    const xml = e.get(destino) ?? "";
    const celdas = new Map<string, Celda>();
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(c[1])![1];
      const tipo = /t="([^"]+)"/.exec(c[1])?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? "")?.[1];
      if (tipo === "inlineStr") celdas.set(ref, entidades([...(c[2] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
      else if (v === undefined) continue;
      else if (tipo === "s") celdas.set(ref, compartidos[Number(v)]);
      else if (tipo === "str") celdas.set(ref, entidades(v));
      else celdas.set(ref, Number(v));
    }
    return { nombre, celdas };
  });
}

/** Filas de una hoja como matrices (columnas A…, filas desde 1), con `undefined` donde no hay celda. */
export function filasDeHoja(h: Hoja): (Celda | undefined)[][] {
  const col = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const fila = (ref: string) => Number(ref.replace(/\D+/g, "")) - 1;
  const filas: (Celda | undefined)[][] = [];
  for (const [ref, v] of h.celdas) (filas[fila(ref)] ??= [])[col(ref)] = v;
  return Array.from(filas, (f) => f ?? []);
}
