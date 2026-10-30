// Neutralización de inyección de fórmulas (CSV/Excel injection): un texto que EMPIEZA con = + - @ (o con tabulador o retorno) podría ejecutarse como fórmula al abrirse o copiarse a otra hoja.
// Se le antepone un apóstrofo, que Excel muestra como texto. Solo se aplica a TEXTO (nombres de catálogo, rótulos, filtros); las cifras se escriben como números.
const PELIGROSO = /^[\s\u0000-\u001f]*[=+\-@\t\r]/;

export const neutralizar = (texto: string): string => (PELIGROSO.test(texto) ? `'${texto}` : texto);
