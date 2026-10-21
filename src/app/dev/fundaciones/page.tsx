import type { Metadata } from "next";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ValorToken } from "./ValorToken";

export const metadata: Metadata = { title: "Fundaciones · RUPE (solo desarrollo)" };

const GRUPOS_COLOR: { titulo: string; tokens: string[] }[] = [
  { titulo: "Primario", tokens: ["primary", "primary-hover", "primary-pressed", "primary-soft", "on-primary"] },
  { titulo: "Acento", tokens: ["accent", "accent-soft", "on-accent"] },
  {
    titulo: "Neutros",
    tokens: ["background", "surface", "surface-raised", "border", "border-strong", "text", "text-muted", "disabled-text", "disabled-bg"],
  },
  {
    titulo: "Semánticos",
    tokens: ["success", "warning", "danger", "info", "focus-ring", "success-bg", "warning-bg", "danger-bg", "info-bg"],
  },
  {
    titulo: "Chips de estado (fondo y texto)",
    tokens: ["extraviado", "en-busqueda", "avistamiento", "en-seguimiento", "localizado", "cerrado"].flatMap((e) => [
      `estado-${e}-bg`,
      `estado-${e}-fg`,
    ]),
  },
  { titulo: "Avatares", tokens: ["avatar-1", "avatar-2", "avatar-3", "avatar-4", "avatar-5", "avatar-6"] },
];

const ESCALA: { clase: string; nombre: string; medida: string; peso: string; muestra: string }[] = [
  { clase: "text-caption font-medium", nombre: "text-xs · caption", medida: "12 / 16", peso: "400 · 500", muestra: "Aviso de privacidad · Contacto" },
  { clase: "text-small", nombre: "text-sm · small", medida: "14 / 20", peso: "400 · 500 · 600", muestra: "Solo una fotografía por caso" },
  { clase: "text-body", nombre: "text-base · body", medida: "16 / 24", peso: "400 · 500 · 600", muestra: "Describe cómo era tu perro" },
  { clase: "text-h3 font-semibold", nombre: "text-lg · h3", medida: "18 / 28", peso: "600", muestra: "Nombre del perro" },
  { clase: "text-h2 font-semibold", nombre: "text-xl · h2", medida: "20 / 28", peso: "600", muestra: "Datos del extravío" },
  { clase: "text-2xl font-bold", nombre: "text-2xl", medida: "24 / 32", peso: "700", muestra: "Mis registros" },
  { clase: "text-3xl font-bold", nombre: "text-3xl", medida: "30 / 36", peso: "700 · 800", muestra: "Tablero" },
  { clase: "text-display font-extrabold", nombre: "text-4xl · display", medida: "36 / 40", peso: "800", muestra: "Encuentra a tu perro" },
];

const ICONOS: { nombre: NombreIcono; uso: string }[] = [
  { nombre: "home", uso: "Inicio" }, { nombre: "pets", uso: "Perro / caso" }, { nombre: "search", uso: "Buscar folio" },
  { nombre: "add_circle", uso: "Registrar extravío" }, { nombre: "photo_camera", uso: "Fotografía" },
  { nombre: "location_on", uso: "Ubicación" }, { nombre: "map", uso: "Mapa" }, { nombre: "notifications", uso: "Avistamientos" },
  { nombre: "print", uso: "Imprimir ficha" }, { nombre: "share", uso: "Compartir" },
  { nombre: "qr_code_2", uso: "Código QR" }, { nombre: "visibility", uso: "Ver / ocultar" }, { nombre: "schedule", uso: "Fecha y hora" },
  { nombre: "person", uso: "Cuenta / avatar" }, { nombre: "menu", uso: "Menú" },
  { nombre: "light_mode", uso: "Modo claro" }, { nombre: "dark_mode", uso: "Modo oscuro" }, { nombre: "arrow_back", uso: "Regresar" },
  { nombre: "close", uso: "Cerrar" }, { nombre: "delete", uso: "Eliminar / cancelar" },
  { nombre: "lock", uso: "Acceso restringido" }, { nombre: "check_circle", uso: "Éxito" }, { nombre: "info", uso: "Información" },
  { nombre: "warning", uso: "Advertencia" }, { nombre: "error", uso: "Error" },
];

const TEMAS = [
  { id: "light", nombre: "Modo claro" },
  { id: "dark", nombre: "Modo oscuro" },
] as const;

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-h2 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function PanelTema({ tema, children }: { tema: (typeof TEMAS)[number]; children: React.ReactNode }) {
  return (
    <div data-theme={tema.id} className="rounded-tarjeta border border-border bg-background p-4 text-text">
      <h3 className="mb-3 text-h3 font-semibold">{tema.nombre}</h3>
      {children}
    </div>
  );
}

export default function Fundaciones() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">Fundaciones</h1>
          <p className="text-small text-text-muted">Bloque 0 · página de desarrollo, no forma parte del sitio.</p>
        </div>
        <ThemeToggle />
      </header>

      <Seccion titulo="Colores">
        {GRUPOS_COLOR.map((grupo) => (
          <div key={grupo.titulo} className="mb-6">
            <h3 className="mb-2 text-small font-semibold text-text-muted">{grupo.titulo}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {TEMAS.map((tema) => (
                <PanelTema key={tema.id} tema={tema}>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {grupo.tokens.map((token) => (
                      <li key={token} className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="size-10 shrink-0 rounded-campo border border-border-strong"
                          style={{ background: `var(--${token})` }}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-small font-medium">{token}</span>
                          <ValorToken variable={token} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </PanelTema>
              ))}
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Tipografía (Montserrat)">
        <div className="rounded-tarjeta border border-border bg-surface p-4">
          <ul className="divide-y divide-border">
            {ESCALA.map((fila) => (
              <li key={fila.nombre} className="grid gap-1 py-3 md:grid-cols-[14rem_1fr] md:items-center">
                <span className="text-caption text-text-muted">
                  <span className="font-mono">{fila.nombre}</span> · {fila.medida} px · {fila.peso}
                </span>
                <span className={fila.clase}>{fila.muestra}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="font-normal">Regular 400</span>
            <span className="font-medium">Medium 500</span>
            <span className="font-semibold">Semibold 600</span>
            <span className="font-bold">Bold 700</span>
            <span className="font-extrabold">Extrabold 800</span>
            <em className="font-normal">Cursiva 400</em>
            <em className="font-semibold">Cursiva 600</em>
          </p>
          <p className="mt-2 text-body">ABCDEFGHIJKLMNÑOPQRSTUVWXYZ abcdefghijklmnñopqrstuvwxyz áéíóú ü ¿? ¡! 0123456789</p>
          <label className="mt-4 block text-small font-medium" htmlFor="campo-muestra">
            Campo de formulario (16 px, 48 px de alto, radio 8 px)
          </label>
          <input
            id="campo-muestra"
            type="text"
            placeholder="Ej. Max"
            className="mt-1 h-campo w-full max-w-sm rounded-campo border-[1.5px] border-border-strong bg-surface px-3 text-text placeholder:text-text-muted"
          />
        </div>
      </Seccion>

      <Seccion titulo="Íconos (Material Symbols Rounded, relleno)">
        <div className="grid gap-4 md:grid-cols-2">
          {TEMAS.map((tema) => (
            <PanelTema key={tema.id} tema={tema}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ICONOS.map((icono) => (
                  <li key={icono.nombre} className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-campo bg-primary-soft text-primary">
                      <Icono nombre={icono.nombre} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-small font-medium">{icono.uso}</span>
                      <span className="truncate font-mono text-caption text-text-muted">{icono.nombre}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-end gap-4 text-primary">
                {[20, 24, 32, 48].map((t) => (
                  <Icono key={t} nombre="pets" tamano={t} />
                ))}
                <span className="text-caption text-text-muted">20 · 24 · 32 · 48 px</span>
              </p>
            </PanelTema>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Logotipos">
        <div className="grid gap-4 md:grid-cols-2">
          {TEMAS.map((tema) => (
            <PanelTema key={tema.id} tema={tema}>
              <div className="flex flex-wrap items-end gap-6">
                <figure className="flex flex-col gap-2">
                  <Logo variante="horizontal" ancho={200} />
                  <figcaption className="text-caption text-text-muted">horizontal</figcaption>
                </figure>
                <figure className="flex flex-col gap-2">
                  <Logo variante="cuadrado" ancho={96} />
                  <figcaption className="text-caption text-text-muted">cuadrado</figcaption>
                </figure>
                <figure className="flex flex-col gap-2">
                  <Logo variante="simbolo" ancho={64} />
                  <figcaption className="text-caption text-text-muted">símbolo</figcaption>
                </figure>
              </div>
            </PanelTema>
          ))}
        </div>
        <div data-theme="light" className="mt-4 flex flex-wrap items-center gap-6 rounded-tarjeta bg-primary p-4">
          <Logo variante="horizontal" tono="blanco" ancho={200} />
          <Logo variante="cuadrado" tono="blanco" ancho={96} />
          <Logo variante="simbolo" tono="blanco" ancho={64} />
          <span className="text-small text-on-primary">tono=&quot;blanco&quot; sobre fondo de color</span>
        </div>
      </Seccion>

      <Seccion titulo="Cambio de tema">
        <ThemeToggle />
      </Seccion>
    </main>
  );
}
