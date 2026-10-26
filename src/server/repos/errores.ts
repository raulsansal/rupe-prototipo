/** Un valor que debe ser único ya existe (folio o token del QR). El servicio reintenta con otro valor; el mensaje no revela detalles internos. */
export class ConflictoDeUnicidad extends Error {
  constructor(readonly campo: "folio" | "token") {
    super("Valor duplicado");
    this.name = "ConflictoDeUnicidad";
  }
}
