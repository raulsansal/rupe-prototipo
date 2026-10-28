// Reglas de composición de la hoja de la ficha de búsqueda: UNA sola fuente para la hoja en pantalla (FichaBusqueda), el visor y el PDF (pdf-lib), de modo que no diverjan.
// Sin React ni acceso a servidor: se importa desde ambos lados. Todas las medidas están en puntos (1 pt = 1/72 in); Carta 612×792 y Media carta HORIZONTAL 612×396 (21.6 × 14 cm).
// La hoja garantiza POR CONSTRUCCIÓN que la zona de la fotografía es ≥ 40 % de la hoja: todo texto tiene tope de líneas y tamaño fijo, así que la banda de texto/QR tiene una
// altura máxima constante y la zona de la fotografía recibe el resto, sin depender del contenido.

export type TamanoHoja = "carta" | "media-carta";

export const PAGINA_PT: Record<TamanoHoja, { ancho: number; alto: number }> = {
  carta: { ancho: 612, alto: 792 },
  "media-carta": { ancho: 612, alto: 396 },
};

/** Margen de la hoja (6,94 % del ancho, el de la lámina 4.11) en puntos. */
export const MARGEN_PT = 42.5;

/** Topes de línea (con elipsis y corte de palabras largas): valen para los máximos de las validaciones (nombre 50, colonia 100, características 300). Media carta, con menos alto, lleva 2 líneas de características. */
export const TOPES_DE_LINEA: Record<TamanoHoja, { nombre: number; datos: number; caracteristicas: number; lugar: number }> = {
  carta: { nombre: 1, datos: 2, caracteristicas: 3, lugar: 2 },
  "media-carta": { nombre: 1, datos: 2, caracteristicas: 2, lugar: 2 },
};

/** Tamaño de letra (pt) y de interlínea (múltiplo del tamaño) de cada bloque de texto. */
export type EstiloTexto = { tam: number; interlinea: number };
export const TIPOGRAFIA: Record<TamanoHoja, Record<"etiqueta" | "titulo" | "nombre" | "datos" | "caracteristicas" | "fechaLugar" | "indicacion" | "folio" | "pie", EstiloTexto>> = {
  carta: {
    etiqueta: { tam: 8.6, interlinea: 1.2 },
    titulo: { tam: 28, interlinea: 1 },
    nombre: { tam: 22, interlinea: 1.15 },
    datos: { tam: 14, interlinea: 1.25 },
    caracteristicas: { tam: 14, interlinea: 1.25 },
    fechaLugar: { tam: 14, interlinea: 1.35 },
    indicacion: { tam: 11, interlinea: 1.2 },
    folio: { tam: 17, interlinea: 1.2 },
    pie: { tam: 7.6, interlinea: 1.2 },
  },
  "media-carta": {
    etiqueta: { tam: 6.1, interlinea: 1.2 },
    titulo: { tam: 17.7, interlinea: 1.05 },
    nombre: { tam: 15.3, interlinea: 1.15 },
    datos: { tam: 9.2, interlinea: 1.25 },
    caracteristicas: { tam: 9.2, interlinea: 1.25 },
    fechaLugar: { tam: 9.2, interlinea: 1.3 },
    indicacion: { tam: 9.2, interlinea: 1.15 },
    folio: { tam: 13.5, interlinea: 1.15 },
    pie: { tam: 6, interlinea: 1.2 },
  },
};

/** Símbolo del QR impreso (sin la zona de silencio de 4 módulos), corrección M, versión 4 a 5 (33 a 37 módulos): Carta 3,6 cm (módulo ≈ 1,0 mm) y Media carta 2,5 cm (módulo ≈ 0,68 mm). */
export const QR_SIMBOLO_CM: Record<TamanoHoja, number> = { carta: 3.6, "media-carta": 2.5 };
export const MODULOS_ZONA_DE_SILENCIO = 4;
export const PT_POR_CM = 72 / 2.54;

const mm = (pt: number) => Math.round(pt * 100) / 100;
/** Altura (pt) de un texto de `lineas` líneas. */
export const altoDeTexto = (e: EstiloTexto, lineas: number) => mm(e.tam * e.interlinea * lineas);

/** Geometría Carta (apilada, bloque inferior en DOS columnas): encabezado, título, zona de la fotografía, banda de texto + QR y pie. */
const CARTA = {
  encabezado: 22,
  titulo: 30,
  separacion: 8,
  /** Altura MÁXIMA de la banda inferior (texto a la izquierda, QR y folio a la derecha): todo lo que hay en ella tiene tope de líneas. */
  bandaMaxima: 184,
  pie: 18,
  columnaQr: 176,
};

export type Geometria = {
  /** Área útil (dentro de los márgenes). */
  util: { ancho: number; alto: number };
  /** Zona MÍNIMA de la fotografía, en el peor caso de texto (puede crecer si el texto ocupa menos). */
  foto: { ancho: number; alto: number };
  /** Fracción de la hoja que ocupa la zona mínima de la fotografía. */
  fraccionFoto: number;
};

export function geometriaDeHoja(tamano: TamanoHoja): Geometria {
  const { ancho, alto } = PAGINA_PT[tamano];
  const util = { ancho: ancho - 2 * MARGEN_PT, alto: alto - 2 * MARGEN_PT };
  if (tamano === "carta") {
    const sobrante = util.alto - CARTA.encabezado - CARTA.titulo - 4 * CARTA.separacion - CARTA.bandaMaxima - CARTA.pie;
    return { util, foto: { ancho: util.ancho, alto: sobrante }, fraccionFoto: (util.ancho * sobrante) / (ancho * alto) };
  }
  // Media carta: la fotografía ocupa 52 % del ancho de la hoja y todo el alto útil; el resto va en la columna derecha.
  const fotoAncho = 0.52 * ancho;
  return { util, foto: { ancho: fotoAncho, alto: util.alto }, fraccionFoto: (fotoAncho * util.alto) / (ancho * alto) };
}

export const GEOMETRIA_CARTA = CARTA;

/** Relleno de la zona de la fotografía cuando la imagen (completa, sin recorte) no la cubre: «neutro» = papel gris claro; «atenuado» = la misma foto a ~16 % de opacidad. */
export const RELLENO_FOTO: "neutro" | "atenuado" = "neutro";
export const OPACIDAD_RELLENO = 0.16;

/** Cómo se acomoda la fotografía en su zona: «contenido» = completa y sin recorte (con bandas libres); «cubrir» = llena la zona y recorta lo que sobra. */
export type AjusteFoto = "contenido" | "cubrir";

/** Zona realmente cubierta por la imagen (pt) y fracción recortada de la imagen, para una zona de `caja` y una imagen de proporción ancho/alto `aspecto`. */
export function fotoVisible(caja: { ancho: number; alto: number }, aspecto: number, ajuste: AjusteFoto) {
  const cajaAspecto = caja.ancho / caja.alto;
  const anchoCompleto = aspecto >= cajaAspecto; // la imagen es más ancha que la zona
  if (ajuste === "contenido") {
    const ancho = anchoCompleto ? caja.ancho : caja.alto * aspecto;
    return { ancho, alto: ancho / aspecto, recortado: 0 };
  }
  return { ancho: caja.ancho, alto: caja.alto, recortado: anchoCompleto ? 1 - cajaAspecto / aspecto : 1 - aspecto / cajaAspecto };
}

// ---------------------------------------------------------------------------------------------------------------------------------- texto de la hoja
/** Caracteres que la hoja (Montserrat, subconjunto latino) sabe dibujar: ASCII imprimible, Latin-1, œ, ı y la puntuación habitual (el PDF vuelve a filtrar con el juego real de la fuente incrustada). */
export function esCaracterDeLaHoja(cp: number): boolean {
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa1 && cp <= 0xff && cp !== 0xad) || cp === 0xa0 || [0x131, 0x152, 0x153, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122].includes(cp);
}

/**
 * Deja el texto listo para la hoja (pantalla y PDF usan ESTA función, así coinciden): normaliza a NFC, junta los espacios y saltos de línea, quita controles, ceros de ancho
 * y marcas de dirección, y sustituye por «?» lo que la fuente no puede dibujar (emoji, escrituras no latinas), una sola vez por cada tramo. Nunca lanza.
 */
export function limpiarTextoParaHoja(texto: string, soporta: (cp: number) => boolean = esCaracterDeLaHoja): string {
  let salida = "";
  let sustituyendo = false;
  for (const c of String(texto ?? "").normalize("NFC")) {
    const cp = c.codePointAt(0)!;
    const control = cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x206f) || cp === 0xfeff || (cp >= 0xfe00 && cp <= 0xfe0f);
    if (control) {
      if (cp === 0x09 || cp === 0x0a || cp === 0x0d || cp === 0x2028) salida += " ";
      continue; // controles y marcas invisibles se descartan (el emoji ya trae su selector de variación: no cuenta aparte)
    }
    if (cp === 0xa0) {
      salida += " ";
      sustituyendo = false;
    } else if (soporta(cp)) {
      salida += c;
      sustituyendo = false;
    } else if (!sustituyendo) {
      salida += "?";
      sustituyendo = true;
    }
  }
  return salida.replace(/ {2,}/g, " ").trim();
}

export type BloqueId = "encabezado" | "titulo" | "nombre" | "datos" | "caracteristicas" | "fecha" | "lugar" | "indicacion" | "folio" | "pie";
/** Un bloque de la hoja: `rotulo` va en negrita antes del texto (p. ej. «Lugar:»). */
export type Bloque = { id: BloqueId; rotulo?: string; texto: string; maxLineas: number };

/** Lo que la ficha necesita para componerse: SOLO campos públicos (FichaPublica) más el dominio de consulta. */
export type FichaParaHoja = {
  nombre: string; sexo: string; raza: string; edad: string; tamano: string; color: string; caracteristicasDistintivas?: string;
  fechaExtravio: string; coloniaZona: string; alcaldia: string; folio: string;
};

/**
 * Lista ORDENADA de bloques de la hoja, con su tope de líneas. Es la misma para la hoja en pantalla y el PDF: lo único que cambia entre ellos es cómo se parten las líneas
 * (CSS en pantalla, medida de la fuente en el PDF). `fechaLarga` ya viene formateada («26 de octubre de 2026»).
 */
export function contenidoDeFicha(f: FichaParaHoja, fechaLarga: string, dominio: string, tamano: TamanoHoja): Bloque[] {
  const L = TOPES_DE_LINEA[tamano];
  const t = (s: string) => limpiarTextoParaHoja(s);
  const datos = [f.sexo, f.edad, f.raza, f.tamano, f.color].map(t).join(" · ");
  const carta = tamano === "carta";
  const pie = carta
    ? `O entra a ${t(dominio)} y escribe el folio. Esta ficha no incluye datos de contacto de la persona tutora; los avisos llegan a ella a través del sistema. No sustituye ningún registro oficial.`
    : `Consulta en ${t(dominio)} con tu folio. Esta ficha no incluye datos de contacto de la persona tutora. No sustituye ningún registro oficial.`;
  const bloques: Bloque[] = [
    { id: "encabezado", texto: "Ficha de búsqueda", maxLineas: 1 },
    { id: "titulo", texto: "¡Ayúdame a regresar a casa!", maxLineas: carta ? 1 : 2 },
    { id: "nombre", texto: t(f.nombre), maxLineas: L.nombre },
    { id: "datos", texto: datos, maxLineas: L.datos },
  ];
  if (f.caracteristicasDistintivas && t(f.caracteristicasDistintivas)) bloques.push({ id: "caracteristicas", rotulo: "Características distintivas:", texto: t(f.caracteristicasDistintivas), maxLineas: L.caracteristicas });
  const indicacion: Bloque = { id: "indicacion", texto: carta ? "¿Lo viste? Escanea el código." : "¿Lo viste? Escanea el código y cuéntanos dónde.", maxLineas: 3 };
  const folio: Bloque = { id: "folio", texto: f.folio, maxLineas: 1 };
  bloques.push(
    { id: "fecha", rotulo: "Se extravió el", texto: t(fechaLarga), maxLineas: 1 },
    { id: "lugar", rotulo: "Lugar:", texto: `col. ${t(f.coloniaZona)}, alcaldía ${t(f.alcaldia)}`, maxLineas: L.lugar },
    // Orden de lectura: en Carta la indicación va sobre el QR y el folio debajo; en Media carta el folio tiene su propia línea sobre la indicación y el QR.
    ...(carta ? [indicacion, folio] : [folio, indicacion]),
    { id: "pie", texto: pie, maxLineas: carta ? 2 : 3 },
  );
  return bloques;
}

// ------------------------------------------------------------------------------------------------------------------------------- ajuste de líneas
export type Segmento = { t: string; negrita?: boolean };
/** Mide el ancho (pt) de un texto en la fuente y el tamaño del bloque. */
export type Medir = (texto: string, negrita: boolean) => number;

/**
 * Parte los segmentos en líneas de a lo más `ancho` pt y `maxLineas` líneas: ajusta por palabras, parte las palabras que no caben en una línea y, si sobra texto,
 * termina la última línea con «…» (siempre dentro del ancho). Devuelve las líneas como listas de segmentos. Nunca lanza.
 */
export function ajustarSegmentos(segmentos: Segmento[], maxLineas: number, ancho: number, medir: Medir): Segmento[][] {
  const palabras: Segmento[] = segmentos.flatMap((s) => s.t.split(" ").filter(Boolean).map((p) => ({ t: p, negrita: s.negrita })));
  const lineas: Segmento[][] = [];
  let actual: Segmento[] = [];
  let usado = 0;
  const espacio = (n: boolean) => medir(" ", n);
  const ancho1 = (s: Segmento) => medir(s.t, !!s.negrita);
  const cerrar = () => {
    if (actual.length) lineas.push(actual);
    actual = [];
    usado = 0;
  };
  const pendientes = [...palabras];
  while (pendientes.length) {
    const p = pendientes.shift()!;
    const w = ancho1(p);
    const conEspacio = actual.length ? espacio(!!p.negrita) : 0;
    if (usado + conEspacio + w <= ancho) {
      actual.push(p);
      usado += conEspacio + w;
      continue;
    }
    if (actual.length) {
      cerrar();
      pendientes.unshift(p);
      continue;
    }
    // Palabra más ancha que una línea completa: se parte por caracteres.
    let corte = 1;
    while (corte < p.t.length && ancho1({ t: p.t.slice(0, corte + 1), negrita: p.negrita }) <= ancho) corte++;
    actual.push({ t: p.t.slice(0, corte), negrita: p.negrita });
    cerrar();
    if (corte < p.t.length) pendientes.unshift({ t: p.t.slice(corte), negrita: p.negrita });
  }
  cerrar();
  if (lineas.length <= maxLineas) return lineas;
  const visibles = lineas.slice(0, maxLineas);
  const ultima = visibles[maxLineas - 1];
  // Elipsis: se quita texto de la última línea hasta que «…» quepa.
  const elipsis = "…";
  const medirLinea = (l: Segmento[]) => l.reduce((a, s, i) => a + ancho1(s) + (i ? espacio(!!s.negrita) : 0), 0);
  for (;;) {
    const ult = ultima[ultima.length - 1];
    if (!ult) break;
    if (medirLinea(ultima) + medir(elipsis, !!ult.negrita) <= ancho) break;
    if (ult.t.length > 1) ult.t = ult.t.slice(0, -1);
    else ultima.pop();
  }
  while (ultima.length > 1 && /^[·,.;:]+$/.test(ultima[ultima.length - 1].t)) ultima.pop(); // un «·» suelto no se deja antes de la elipsis
  if (ultima.length) ultima[ultima.length - 1] = { t: ultima[ultima.length - 1].t.replace(/[\s,.;:·]+$/, "") + elipsis, negrita: ultima[ultima.length - 1].negrita };
  else ultima.push({ t: elipsis });
  return visibles;
}
