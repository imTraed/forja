/* Pantalla de inicio: qué toca hoy, qué dice el entrenador y los pendientes. */
import {
  S, rutinaActiva, siguienteDia, semanaPrograma, enCalibracion, enDeload,
  registrarPeso, pesoActual, historial, SEMANAS_CALIBRACION,
} from '../store.js';
import { acts, esc, toast, kg, num, hoyISO, fechaCorta, diasEntre } from '../lib/ui.js';
import { consejoDelDia, informeCalibracionDisponible, generarInformeCalibracion } from '../engine/coach.js';
import { sugerencia } from '../engine/progression.js';
import { objetivos, cargarAlimentos, ingeridoHoy, comidasHechas } from '../engine/nutrition.js';
import { cargar as cargarCatalogo } from '../data/catalog.js';

export async function render(ctx) {
  const rutina = rutinaActiva();
  const dia = siguienteDia(rutina);
  const sem = semanaPrograma();
  const consejo = consejoDelDia();
  const activa = S.sesionActiva;

  ctx.view.innerHTML = `
    ${cabecera(sem)}
    ${informeCalibracionDisponible() ? bannerInforme() : ''}
    ${tarjetaConsejo(consejo)}
    ${activa ? tarjetaEnCurso(activa) : tarjetaSesion(rutina, dia)}
    ${tarjetaPeso()}
    ${tarjetaComida()}
    <button class="btn quiet block mt" data-act="ajustes">Ajustes y respaldo</button>`;

  acts(ctx.view, {
    entrenar: () => ctx.ir('/entreno'),
    rutinas: () => ctx.ir('/rutinas'),
    comida: () => ctx.ir('/comida'),
    progreso: () => ctx.ir('/progreso'),
    ajustes: () => ctx.ir('/ajustes'),
    verInforme: () => { generarInformeCalibracion(); ctx.ir('/progreso'); },
    guardarPeso: () => {
      const v = Number(ctx.view.querySelector('#peso-hoy').value);
      if (!v || v < 25 || v > 300) return toast('Ese peso no cuadra', 'bad');
      registrarPeso(v);
      toast('Peso guardado', 'ok');
      render(ctx);
    },
  });

  // El detalle de la sesión necesita el catálogo y los macros; se cargan después
  // de pintar para que la pantalla aparezca al instante.
  pintarDetalleSesion(ctx, rutina, dia);
  pintarMacros(ctx);
}

/* ---------- Bloques ---------- */

function cabecera(sem) {
  const nombre = S.perfil?.nombre?.trim();
  const hora = new Date().getHours();
  const saludo = hora < 6 ? 'Buenas noches' : hora < 14 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches';
  const etiqueta = enDeload() ? '<span class="tag warn">Descarga</span>'
    : enCalibracion() ? `<span class="tag accent">Calibración ${Math.max(1, sem)}/${SEMANAS_CALIBRACION}</span>`
      : `<span class="tag">Semana ${sem}</span>`;
  return `
    <div class="row" style="align-items:flex-start;justify-content:space-between">
      <div>
        <h2 class="page-title">${saludo}${nombre ? `, ${esc(nombre)}` : ''}</h2>
        <p class="page-sub mb0">${fechaCorta(hoyISO())}</p>
      </div>
      ${etiqueta}
    </div>
    <div style="height:16px"></div>`;
}

function bannerInforme() {
  return `
    <button class="card accent glow" data-act="verInforme" style="width:100%;text-align:left">
      <div class="eyebrow">Ya tengo tus números</div>
      <h3>Informe de calibración listo</h3>
      <p class="muted small mb0">Terminaron las dos semanas de medición. Toca para ver de qué eres capaz y cómo voy a subirte a partir de ahora.</p>
    </button>`;
}

function tarjetaConsejo(c) {
  const color = { ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[c.tono] || 'var(--accent)';
  return `
    <div class="card" style="border-left:3px solid ${color}">
      <div class="eyebrow" style="color:${color}">El entrenador dice</div>
      <h3>${esc(c.titulo)}</h3>
      <p class="muted small mb0">${esc(c.texto)}</p>
    </div>`;
}

function tarjetaSesion(rutina, dia) {
  if (!rutina || !dia) {
    return `
      <div class="card accent">
        <h3>Aún no tienes rutina</h3>
        <p class="muted small">Crea una en dos toques: te la genero según tus días y tu material, o la montas ejercicio a ejercicio.</p>
        <button class="btn primary block" data-act="rutinas">Crear rutina</button>
      </div>`;
  }
  const ultima = S.sesiones.filter((s) => s.diaId === dia.id).at(-1);
  const desde = ultima ? diasEntre(ultima.fecha, hoyISO()) : null;
  return `
    <div class="card accent glow">
      <div class="eyebrow">Hoy toca</div>
      <div class="row" style="align-items:center;justify-content:space-between">
        <h3 style="font-size:1.35rem">${esc(dia.nombre)}</h3>
        <span class="tag">${dia.ejercicios.length} ejercicios</span>
      </div>
      <p class="muted tiny" style="margin:6px 0 12px">
        ${esc(rutina.nombre)}${desde != null ? ` · última vez hace ${desde} día${desde === 1 ? '' : 's'}` : ' · primera vez'}
      </p>
      <div id="detalle-sesion" class="stack" style="gap:7px;margin-bottom:14px">
        ${dia.ejercicios.slice(0, 4).map((e) => `
          <div class="row small" style="justify-content:space-between">
            <span class="truncate" style="text-transform:capitalize">${esc(e.nombre)}</span>
            <span class="faint mono">${e.series}×${e.repMin}-${e.repMax}</span>
          </div>`).join('')}
        ${dia.ejercicios.length > 4 ? `<span class="faint tiny">y ${dia.ejercicios.length - 4} más…</span>` : ''}
      </div>
      <button class="btn primary block lg" data-act="entrenar">Empezar entreno</button>
    </div>`;
}

function tarjetaEnCurso(sesion) {
  const hechas = sesion.ejercicios.reduce((t, e) => t + e.sets.filter((s) => s.reps > 0).length, 0);
  const total = sesion.ejercicios.reduce((t, e) => t + e.series, 0);
  return `
    <div class="card accent glow">
      <div class="eyebrow">Sesión en curso</div>
      <h3>${esc(sesion.nombre)}</h3>
      <p class="muted small">${hechas} de ${total} series hechas.</p>
      <div class="bar" style="margin-bottom:14px"><i style="width:${total ? (hechas / total) * 100 : 0}%"></i></div>
      <button class="btn primary block lg" data-act="entrenar">Continuar entreno</button>
    </div>`;
}

function tarjetaPeso() {
  const actual = pesoActual();
  const hoy = S.peso.find((p) => p.fecha === hoyISO());
  return `
    <div class="card">
      <div class="card-head">
        <h3>Peso corporal</h3>
        ${actual ? `<span class="tag">${kg(actual)}</span>` : ''}
      </div>
      ${hoy
    ? `<p class="muted small mb0">Ya te has pesado hoy: <b>${kg(hoy.kg)}</b>. Si te vuelves a pesar, se sustituye.</p>
         <div class="row mt">
           <input class="input num grow" id="peso-hoy" type="number" inputmode="decimal" step="0.1" value="${hoy.kg}">
           <button class="btn ghost" data-act="guardarPeso">Actualizar</button>
         </div>`
    : `<p class="muted small">Pésate en ayunas y siempre igual. Lo que importa es la tendencia, no el número de hoy.</p>
         <div class="row">
           <input class="input num grow" id="peso-hoy" type="number" inputmode="decimal" step="0.1" placeholder="${actual ?? 75}">
           <button class="btn primary" data-act="guardarPeso">Guardar</button>
         </div>`}
    </div>`;
}

function tarjetaComida() {
  return `
    <button class="card" data-act="comida" style="width:100%;text-align:left;display:block">
      <div class="card-head">
        <h3>Comida de hoy</h3>
        <span class="tag" id="comida-tag">—</span>
      </div>
      <div id="macros-hoy" class="stat-grid">
        <div class="stat"><b class="faint">—</b><span>kcal</span></div>
        <div class="stat"><b class="faint">—</b><span>proteína</span></div>
        <div class="stat"><b class="faint">—</b><span>carbos</span></div>
      </div>
    </button>`;
}

/* ---------- Cargas diferidas ---------- */

/** Sustituye la lista de la sesión por la de verdad, con el peso ya sugerido. */
async function pintarDetalleSesion(ctx, rutina, dia) {
  const cont = ctx.view.querySelector('#detalle-sesion');
  if (!cont || !dia) return;
  try {
    await cargarCatalogo();
  } catch { return; }
  cont.innerHTML = dia.ejercicios.map((e) => {
    const s = sugerencia(e, historial(e.exId));
    return `
      <div class="row small" style="justify-content:space-between;gap:10px">
        <span class="truncate" style="text-transform:capitalize">${esc(e.nombre)}</span>
        <span class="mono" style="flex:none;color:${s.peso ? 'var(--accent)' : 'var(--faint)'}">
          ${s.peso ? `${num(s.peso)}×${s.reps}` : `${e.repMin}-${e.repMax}`}
        </span>
      </div>`;
  }).join('');
}

async function pintarMacros(ctx) {
  const cont = ctx.view.querySelector('#macros-hoy');
  if (!cont) return;
  try {
    await cargarAlimentos();
  } catch { return; }
  const obj = objetivos();
  if (!obj) return;
  const hecho = ingeridoHoy();
  const plan = S.comida.plan;
  const marcadas = plan ? plan.comidas.filter((c) => comidasHechas()[c.id]).length : 0;

  ctx.view.querySelector('#comida-tag').textContent = plan ? `${marcadas}/${plan.comidas.length} comidas` : 'sin plan';
  cont.innerHTML = `
    <div class="stat hi"><b>${Math.round(hecho.kcal)}</b><span>de ${obj.kcal} kcal</span></div>
    <div class="stat"><b>${Math.round(hecho.p)}</b><span>de ${obj.proteina} g prot.</span></div>
    <div class="stat"><b>${Math.round(hecho.c)}</b><span>de ${obj.carbo} g carb.</span></div>`;
}
