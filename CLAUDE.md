# RUPE · Registro Único de Perros Extraviados (Ciudad de México)

Fase actual: MAQUETADO fiel al diseño aprobado, con datos ficticios (sin BD, API ni autenticación).
Después vendrá el Prototipo: MySQL en Aiven vía API Routes de Next.js (credenciales solo en variables de entorno).
Lee `AGENTS.md` y `node_modules/next/dist/docs/` antes de escribir código Next.js: esta versión difiere de lo habitual.
## Stack
Next.js (App Router, `src/`, alias `@/*`) · React · TypeScript · Tailwind CSS v4 · Montserrat (`next/font`).
Sin ORM ni librerías de UI, de mapas, de estado global o de formularios: componentes a mano con Tailwind.
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
- Los datos de la persona tutora y los campos reservados nunca son públicos: la ficha pública usa solo `FichaPublica` (`src/mocks/tipos.ts`).
- Alcance: solo perros. Sin integración con registros oficiales. El mapa es ilustrativo (`MapaIlustrativo`), no hay mapa real.
- Parámetros de consulta, solo para variantes de capturas y pruebas (lo capturado en los flujos vive solo en memoria):
  `?estado=` en `/ficha/[clave]` (en-curso|localizado|no-disponible), `/acceso` (bloqueo|deshabilitada), `/tutor` (vacio|cargando) y
  `/tutor/casos/[folio]` (en-curso|localizado|cerrado); `/ficha/[clave]/avistamiento`: `?paso=1..6`, `?ubicacion=direccion|mapa|gps|denegado`,
  `?caso=fallecido|combinadas|vacio`, `?datos=ejemplo`; `/tutor/registrar`: `?paso=1|2`, `?raza=otra`; `/tutor/casos/[folio]/ficha`:
  `?modal=visor|compartir|regenerar`, `?hoja=carta|media-carta`; demos de plantillas: `?menu=abierto`.
- Nunca escribir valores de claves, tokens o contraseñas; solo sus nombres. No crear `.env` con valores reales.
- No ejecutar comandos de git que modifiquen el repositorio salvo que se pida; proponer commits pequeños.
## Referencias
- Láminas: `docs/diseno/sistema-de-diseno/` (4.1 a 4.13); mockups por rol: `docs/diseno/mockups/`. Si algo no es inequívoco, anotarlo como duda.
- Historias de usuario y diccionario de datos: `docs/referencia/` (el diccionario manda sobre los prompts).
## Comandos
`npm run dev` · `build` · `lint` · `npx tsc --noEmit` · `verificar-tokens` · `verificar-logos` · `verificar-contraste` ·
`verificar-componentes` · `verificar-plantillas` · `verificar-visitante` · `verificar-tutor`. `npm run capturas` → PNG en `capturas/` (`--secciones=a,b`, `--rutas=/prefijo`).
## Decisiones resueltas
- B1: texto deshabilitado con tokens `disabled-*` (no los tonos de la lámina 4.6); alertas en oscuro con tokens `*-bg`.
- B2: admin con barra lateral desde 1024 px (cajón `<dialog>` antes); pública con navegación desde 1024 px; pie del flujo sin redes.
- B3: menú y pie enlazan a anclas de `/`; «Leer aviso completo» despliega el texto; PUB-06 «Reporte enviado» tras «Enviar reporte».
- B4: folio inexistente y caso cerrado se ven idénticos (PUB-03 C); versión del aviso «v1.0»; modales con `Modal` (`<dialog>`); el QR es ilustrativo.
