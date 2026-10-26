// Ayudas compartidas por verificar-registro y las capturas de P2: imágenes dibujadas en el propio navegador y el llenado de los dos pasos de «Registrar extravío».
import type { Page } from "playwright";

export const ENTRADA_FOTO = "input[type=file]:not([capture])";

/** Crea en el navegador una imagen (la dibuja un lienzo) y la entrega al campo de la fotografía, como si la persona la eligiera. */
export async function elegirImagenGenerada(p: Page, tipo: "ruido-grande" | "transparente" | "degradado") {
  return p.evaluate(
    async ([clase, selector]) => {
      const lienzo = document.createElement("canvas");
      const c = lienzo.getContext("2d")!;
      if (clase === "ruido-grande") {
        lienzo.width = 2000;
        lienzo.height = 2000;
        const datos = c.createImageData(2000, 2000);
        for (let y = 0; y < 2000; y += 1) crypto.getRandomValues(datos.data.subarray(y * 8000, (y + 1) * 8000));
        for (let i = 3; i < datos.data.length; i += 4) datos.data[i] = 255;
        c.putImageData(datos, 0, 0);
      } else if (clase === "transparente") {
        lienzo.width = 600;
        lienzo.height = 400;
        c.fillStyle = "rgb(200 20 20)";
        c.beginPath();
        c.arc(300, 200, 120, 0, Math.PI * 2);
        c.fill(); // el resto del lienzo queda TRANSPARENTE
      } else {
        lienzo.width = 800;
        lienzo.height = 600;
        const g = c.createLinearGradient(0, 0, 800, 600);
        g.addColorStop(0, "rgb(240 180 90)");
        g.addColorStop(1, "rgb(90 120 200)");
        c.fillStyle = g;
        c.fillRect(0, 0, 800, 600);
      }
      const blob: Blob = await new Promise((ok) => lienzo.toBlob((b) => ok(b!), "image/png"));
      const archivo = new File([blob], `${clase}.png`, { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(archivo);
      const input = document.querySelector<HTMLInputElement>(selector)!;
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return archivo.size;
    },
    [tipo, ENTRADA_FOTO] as const,
  );
}

export const paso1 = (p: Page) => p.locator("[data-paso='1']");
export const paso2 = (p: Page) => p.locator("[data-paso='2']");

export async function llenarPaso1(p: Page, { edad = "0", unidad = "meses" }: { edad?: string; unidad?: string } = {}) {
  const p1 = paso1(p);
  await p.getByLabel(/^Nombre del perro/).fill("Pelusa");
  await p1.locator("label", { hasText: "Hembra" }).click();
  await p1.getByLabel(/^Raza/).selectOption({ label: "Mestizo/No identificada" });
  await p1.getByLabel("Unidad").selectOption(unidad);
  await p1.getByLabel(/^Valor/).selectOption(edad);
  await p1.locator("label", { hasText: "Pequeño" }).click();
  await p1.getByLabel(/^Color/).fill("Blanco con manchas");
}
export async function llenarPaso2(p: Page) {
  const p2 = paso2(p);
  const hoy = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
  await p2.locator("input[type=date]").fill(hoy);
  await p2.locator("label", { hasText: "Tarde" }).click();
  await p2.getByLabel(/^Alcaldía/).selectOption("Coyoacán");
  await p2.getByLabel(/^Colonia o zona/).fill("Del Carmen");
  await p2.getByLabel(/^Calle o cruce/).fill("Calle Reservada 99");
  await p2.getByLabel(/^Motivo del extravío/).selectOption({ label: "Portones o puertas abiertas" });
}


export const botonContinuar = (p: Page) => p.getByRole("button", { name: /^(Guardar y continuar|Guardar registro)$/ });

/** Captura los dos pasos con una imagen generada (sin guardar todavía). */
export async function capturarRegistroCompleto(p: Page, opciones: { edad?: string; unidad?: string } = {}) {
  await elegirImagenGenerada(p, "degradado");
  await p.getByAltText("Vista previa de la fotografía").waitFor({ timeout: 20000 });
  await llenarPaso1(p, opciones);
  await botonContinuar(p).click();
  await llenarPaso2(p);
}

/** Registra un extravío de verdad por la interfaz y espera la confirmación; devuelve el folio asignado. */
export async function registrarPorLaInterfaz(p: Page): Promise<string> {
  await capturarRegistroCompleto(p);
  await botonContinuar(p).click();
  await p.waitForURL(/\/tutor\/casos\/RUPE-[A-HJ-NP-Z2-9]{8}\/creado$/, { timeout: 20000 });
  await p.getByRole("heading", { level: 1, name: "Registro creado" }).waitFor();
  return new URL(p.url()).pathname.split("/")[3];
}
