# FORJA

Entrenador personal en el navegador: rutinas, progresión de pesos, descansos cronometrados y comidas con cantidades concretas. De uso personal, sin cuentas ni servidor.

La idea: dejar de preguntarle a una IA genérica qué peso poner. Apuntas cada serie y la app decide por ti, siempre con la misma regla y explicando el porqué.

## Cómo funciona el entrenador

**Semanas 1 y 2 — calibración.** No sube nada. Mide con qué pesos te mueves y cuántas reps aguantas de verdad. Al terminar emite un informe con tus 1RM estimados, el volumen por grupo muscular y qué le falta a tu reparto.

**Semana 3 en adelante — doble progresión.** Cada ejercicio tiene un rango de reps (por ejemplo 5-8):

- Cierras todas las series en el tope del rango con RIR ≤ 1 → sube el peso un incremento y vuelves al fondo del rango.
- Llegas al rango pero no al tope → mismo peso, una rep más por serie.
- Dos sesiones seguidas por debajo del mínimo → baja un 10 % y vuelve a subir desde ahí.
- Tres sesiones sin mover el 1RM estimado → aviso de estancamiento con salida: descarga o cambio de ejercicio (te propone alternativas del mismo músculo con otro material).

El 1RM estimado sale de Epley contando el RIR como reps que quedaban: `peso × (1 + (reps + RIR) / 30)`.

**Volumen.** Cada serie cuenta entera para el músculo objetivo y media para sus dos secundarios principales, comparado contra un rango semanal por grupo. Así una sentadilla también suma a cuádriceps, no solo a glúteo.

**Comida.** Gasto por Mifflin-St Jeor × factor de actividad, ajustado por objetivo. Proteína 2 g/kg (2,2 en definición), grasa 0,8 g/kg, el resto carbohidrato. El plan reparte esos macros entre tus comidas con gramos concretos. Con el peso corporal de varias semanas, ajusta las calorías solo si la tendencia no va donde debería.

## Uso diario

1. **Hoy** — qué toca, el consejo del entrenador, peso corporal y comidas.
2. **Entrenar** — el peso ya viene puesto; confirmas la serie y el descanso arranca solo.
3. **Rutinas** — generador por días y material, o constructor manual sobre las 1.324 fichas del catálogo.
4. **Progreso** — 1RM por ejercicio, volumen semanal, peso corporal e informes.
5. **Comida** — macros del día, plan editable y lista de la compra.

## Comidas por código de barras

El código de barras no guarda calorías: solo un número (EAN-13 o UPC). Ese número es la llave para buscar en una base de datos.

1. **Leer** — la cámara decodifica el código en el propio móvil. Se usa `BarcodeDetector`, que Chrome en Android trae de serie; en Safari y iOS se carga [ZXing](vendor/zxing-library.min.js) desde `vendor/`, así que también funciona sin conexión. Si la cámara falla, siempre puedes teclear el número.
2. **Consultar** — con ese número se pregunta a [Open Food Facts](https://world.openfoodfacts.org), que es gratis y no pide clave.
3. **Escalar** — la base da los valores por 100 g; tú dices los gramos y se anota en el diario del día.

**Los productos locales casi nunca están** en Open Food Facts. Cuando no aparece, la app te deja crearlo una vez con los datos del envase y lo guarda en *Mis productos*, así que el segundo escaneo es instantáneo y sin conexión. Con el tiempo acabas con tu propia base de lo que comes de verdad, que es lo único que importa.

> La cámara solo funciona con HTTPS. Desde el móvil hay que abrir la web publicada, no un archivo local.

## Cuentas (opcional)

Sin configurar nada, la app funciona en local: cada navegador guarda lo suyo. Si quieres cuentas de verdad — para compartirla y que cada uno tenga sus datos aunque cambie de móvil — hace falta un [Supabase](https://supabase.com) gratuito:

1. Crea un proyecto en supabase.com (plan Free).
2. **SQL Editor → New query**, pega [supabase.sql](supabase.sql) y dale a *Run*. Crea la tabla y las políticas para que nadie pueda leer los datos de otro.
3. **Authentication → Providers → Email**: si quieres que tus amigos entren al momento, desactiva *Confirm email*. Si lo dejas puesto, tendrán que abrir un correo antes de entrar.
4. **Project Settings → API**: copia *Project URL* y la clave *anon public* en [js/config.js](js/config.js).

En cuanto esas dos claves estén puestas, la app pide registro e inicio de sesión al abrirse. La clave `anon` es pública a propósito: va en el navegador de todos y no da acceso a nada por sí sola — lo que protege los datos son las políticas RLS del paso 2.

El estado entero (perfil, rutinas, sesiones, chequeos, comida) viaja como un JSON por usuario y se sube solo unos segundos después de cada cambio. Si no hay internet, se sigue guardando en el móvil y se sube cuando vuelva.

## Instalar en el móvil

Ábrela en Chrome o Safari y usa *Añadir a pantalla de inicio*. Queda como una app: pantalla completa, sin barra del navegador y funcionando sin conexión.

En **Ajustes → Sin conexión** puedes descargar los GIFs de tu rutina para verlos en el gimnasio aunque no tengas datos.

## Publicar

Es un sitio estático sin compilación: subir los archivos ya es desplegar.

**GitHub Pages**

```bash
git remote add origin git@github.com:TU_USUARIO/forja.git && git push -u origin main
```

Después, en *Settings → Pages*, elige la rama `main` y la carpeta `/ (root)`.

**Vercel**

```bash
npx vercel --prod
```

`vercel.json` ya deja el service worker sin caché y el catálogo con caché larga.

**En local**

```bash
npx serve -l 4173 .
```

## Tus datos

Todo vive en el `localStorage` de ese navegador. No hay servidor ni copia en la nube: si borras los datos del navegador o cambias de móvil, se pierde. **Ajustes → Exportar respaldo** guarda un `.json` con todo, e *Importar* lo devuelve.

## Estructura

```
index.html            shell y barra inferior
css/app.css           sistema visual (negro, acento dorado, Inter)
js/app.js             enrutado por hash
js/store.js           estado, persistencia y consultas al historial
js/config.js          claves de Supabase (vacío = modo local)
js/lib/               ui · escaner (códigos de barras) · nube (cuentas y sync)
js/engine/            progression · coach · nutrition · timer · generator · chequeo
js/views/             una vista por pestaña
js/data/              catálogo recortado, alimentos, splits, off (Open Food Facts)
vendor/               ZXing, solo para móviles sin lector nativo
tools/build-dataset.mjs   regenera el catálogo desde el repo original
sw.js                 caché offline
```

El acento del tema es una sola variable: `--accent` en `css/app.css`.

## Regenerar el catálogo

```bash
node tools/build-dataset.mjs
```

Descarga los 16,6 MB de [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), se queda con el español y escribe `js/data/exercises.min.json` (~1 MB). Las imágenes y GIFs se sirven desde el repo original.

Datos de ejercicios: hasaneyldrm/exercises-dataset. Animaciones © [gymvisual.com](https://gymvisual.com/).
