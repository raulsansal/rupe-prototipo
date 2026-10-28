// Imágenes mínimas para las pruebas (solo importan los bytes de cabecera y el tamaño).
export const PNG_1X1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
/** JPEG REAL de 16×12 px (se puede decodificar y re-codificar). */
export const JPEG_REAL = Uint8Array.from(Buffer.from("/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAMABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKAATb//2Q==", "base64"));
/** Sin argumento: el JPEG real. Con un tamaño: bytes con cabecera JPEG (solo para probar tamaños y tipos; NO se pueden decodificar). */
export const jpeg = (bytes?: number): Uint8Array => {
  if (bytes === undefined) return JPEG_REAL;
  const a = new Uint8Array(bytes).fill(7);
  a.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00], 0); // SOI + JFIF
  a.set([0xff, 0xd9], bytes - 2); // EOI
  return a;
};
export const GIF = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
export const SVG = Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>'));
export const HTML = Uint8Array.from(Buffer.from("<html><body>no soy una foto</body></html>"));
