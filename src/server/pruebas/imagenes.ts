// Imágenes mínimas para las pruebas (solo importan los bytes de cabecera y el tamaño).
export const PNG_1X1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
export const jpeg = (bytes = 600): Uint8Array => {
  const a = new Uint8Array(bytes).fill(7);
  a.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00], 0); // SOI + JFIF
  a.set([0xff, 0xd9], bytes - 2); // EOI
  return a;
};
export const GIF = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
export const SVG = Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>'));
export const HTML = Uint8Array.from(Buffer.from("<html><body>no soy una foto</body></html>"));
