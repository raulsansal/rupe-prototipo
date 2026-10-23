# RUPE · Registro Único de Perros Extraviados (Ciudad de México)
Fase actual: MAQUETADO fiel al diseño aprobado, con datos ficticios (sin BD, API ni autenticación).
Después vendrá el Prototipo: MySQL en Aiven vía API Routes de Next.js (credenciales solo en variables de entorno).
Lee `AGENTS.md` y `node_modules/next/dist/docs/` antes de escribir código Next.js: esta versión difiere de lo habitual.
## Stack
Next.js (App Router, `src/`, alias `@/*`) · React · TypeScript · Tailwind CSS v4 · Montserrat (`next/font`).
Sin ORM ni librerías de UI, mapas, estado global o formularios: componentes a mano con Tailwind.
Íconos: Material Symbols Rounded relleno vía `<Icono nombre="..." />` (`npm run iconos` regenera `rutas.ts`).
## Convenciones
- Rutas y textos de interfaz en español de México; "persona tutora" (salvo el nombre literal del rol "Tutor").
- Colores solo con tokens (`bg-background`, `text-text`…), nunca hexadecimales ni `bg-black`/`text-white`. Modo oscuro con las
  variables del `[data-theme]` más cercano: no usar `dark:`. Dónde se cambian (`src/app/globals.css`): claro en `:root,[data-theme="light"]`,
  oscuro en `[data-theme="dark"]` (p. ej. fondo oscuro = `--background`), avatares, `--scrim` y la hoja impresa (`--papel`/`--tinta`) iguales en ambos modos en el bloque `:root` de
  avatares. Después: `verificar-tokens` (compara con el encargo del B0), `verificar-contraste` y `verificar-componentes`.
- Mobile-first (390, 768, 1280 px). Accesibilidad: contraste AA, objetivo táctil ≥ 44 px, estado nunca solo por color, foco visible.
- Componentes en `src/components/ui` (uno por archivo; galería `/dev/componentes`), de dominio en `features`, plantillas en `layout`.
- Plantillas (`/dev/plantillas`): `PlantillaPublica` (layout de `(publico)`), `PlantillaTutor` (`(tutor)/tutor`), `PlantillaAdmin` (`(admin)/admin`)
  y `PlantillaFlujo` (flujos por pasos, rutas en `(flujo)`); un solo `<main id="contenido">` cada una. Con `inline-flex` ocultar con `max-md:hidden`, no `hidden`.
- Datos ficticios en `src/mocks` (importes relativos): `casos.ts` (origen con reservados → `aFichaPublica`), `catalogos.ts`, `parametros.ts`.
  Los datos de la persona tutora y los reservados nunca son públicos: la ficha pública usa solo `FichaPublica` (`tipos.ts`).
- Solo perros, sin registros oficiales. Mapas (`MapaIlustrativo`, TUT-09) y QR (`QrIlustrativo`) son ilustrativos. Ningún enlace interno da 404:
  la ruta sin pantalla usa `PantallaPendiente` (`verificar-visitante` y `verificar-tutor` lo comprueban).
- Parámetros de consulta solo para variantes de capturas y pruebas (lo capturado en los flujos vive en memoria): `?estado=` en `/ficha/[clave]`
  (en-curso|localizado|no-disponible), `/acceso` (bloqueo|deshabilitada|aviso-actualizado), `/registro` (aviso), `/tutor` (vacio|cargando),
  `/tutor/casos/[folio]` (en-curso|localizado|cerrado); `/` `?aviso=abierto`; `/ficha/[clave]/avistamiento`: `?paso=1..6`, `?ubicacion=`
  (direccion|mapa|gps|denegado), `?caso=` (fallecido|combinadas|vacio), `?datos=ejemplo`; `/tutor/registrar`: `?paso=1|2`, `?raza=otra`;
  `.../ficha`: `?modal=` (visor|compartir|regenerar), `?hoja=` (carta|media-carta); `.../avistamientos`: `?filtros=abiertos`; `.../mapa`:
  `?ruta=visible`, `?filtro=abierto`; `.../avistamientos/[id]`: `?foto=visible`; demos de plantillas: `?menu=abierto`.
- Nunca escribir valores de claves, tokens o contraseñas (solo sus nombres) ni crear `.env` reales. Sin comandos de git que modifiquen: proponer commits pequeños.
## Referencias
Láminas: `docs/diseno/sistema-de-diseno/`; mockups por rol: `docs/diseno/mockups/`; HU y diccionario (manda sobre prompts): `docs/referencia/`. Si algo no es inequívoco, anotarlo como duda.
## Comandos
`npm run dev` · `build` · `lint` · `npx tsc --noEmit` · `verificar-tokens` · `-logos` · `-contraste` · `-componentes` · `-plantillas` · `-visitante` · `-tutor`.
`npm run capturas` → PNG en `capturas/` (`--secciones=a,b`, `--rutas=/prefijo`, `--autoprueba`).
## Decisiones resueltas
- B1: texto deshabilitado con `disabled-*`; alertas en oscuro con `*-bg`. B2: admin con barra lateral desde 1024 px (cajón antes); pública con navegación desde 1024 px; pie del flujo sin redes.
- B3: menú y pie enlazan a anclas de `/`; el aviso completo es el modal MOD-01 (v1.0); PUB-06 «Reporte enviado» tras enviar.
- B4: folio inexistente y caso cerrado idénticos (PUB-03 C); modales con `Modal` (`<dialog>`); salir del registro con datos pide confirmación; ficha impresa
  con `EscalaHoja` y foto ≥ 40 %. Capturas: ventana al alto de la página (con modal, 390×844) y medición de solapes (`--autoprueba`).
- B4b: dirección y referencias de un avistamiento solo en TUT-10; foto «Fallecido» no se dibuja hasta «Ver fotografía»; TRA-02/03 son modales con props.
