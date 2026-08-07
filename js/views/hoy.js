/* Pantalla de inicio: qué toca hoy, qué dice el entrenador y los pendientes. */
import {
  S, rutinaActiva, siguienteDia, semanaPrograma, enCalibracion, enDeload,
  registrarPeso, pesoActual, historial, SEMANAS_CALIBRACION,
} from '../store.js';
import { acts, esc, toast, kg, num, hoyISO, fechaCorta, diasEntre } from '../lib/ui.js';
import { consejosDelDia, informeCalibracionDisponible, generarInformeCalibracion } from '../engine/coach.js';
import { sugerencia } from '../engine/progression.js';
import { objetivos, cargarAlimentos, ingeridoHoy, comidasHechas } from '../engine/nutrition.js';
import { cargar as cargarCatalogo } from '../data/catalog.js';

let timerConsejo = null;

export async function render(ctx) {
  const rutina = rutinaActiva();
  const dia = siguienteDia(rutina);
  const sem = semanaPrograma();
  const consejos = consejosDelDia();
  const activa = S.sesionActiva;
  ctx.view.innerHTML = `
    <style>
      #carrusel-scroll::-webkit-scrollbar { display: none; }
    </style>
    ${cabecera(sem)}
    ${informeCalibracionDisponible() ? bannerInforme() : ''}
    <div id="carrusel-consejos" style="margin-bottom: 16px;">
      <div id="carrusel-scroll" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none; gap: 16px; padding-bottom: 4px;">
        ${consejos.map((c) => `
          <div style="flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always;">
            ${tarjetaConsejo(c)}
          </div>
        `).join('')}
      </div>
      ${consejos.length > 1 ? `
        <div id="carrusel-dots" class="row" style="justify-content: center; gap: 6px; margin-top: 12px;">
          ${consejos.map((c, i) => {
            const color = 'var(--accent)';
            return `<div class="dot" data-color="${color}" style="width: 6px; height: 6px; border-radius: 50%; background-color: ${i === 0 ? color : 'var(--line)'}; transition: background-color 0.3s;"></div>`;
          }).join('')}
        </div>
      ` : ''}
    </div>
    ${activa ? tarjetaEnCurso(activa) : tarjetaSesion(rutina, dia)}
    <div style="height:24px"></div>`;

  acts(ctx.view, {
    entrenar: () => ctx.ir('/entreno/hoy'),
    rutinas: () => ctx.ir('/rutinas'),
    wizard: () => ctx.ir('/wizard'),
    verInforme: () => { generarInformeCalibracion(); ctx.ir('/yo'); },
  });

  // El detalle de la sesión necesita el catálogo y los macros; se cargan después
  // de pintar para que la pantalla aparezca al instante.
  pintarDetalleSesion(ctx, rutina, dia);
  pintarMacros(ctx);

  if (timerConsejo) clearInterval(timerConsejo);
  if (consejos.length > 1) {
    // Al esperar que se pinte la vista, enganchamos los listeners
    setTimeout(() => {
      const scrollEl = ctx.view.querySelector('#carrusel-scroll');
      const dots = ctx.view.querySelectorAll('#carrusel-dots .dot');
      if (!scrollEl) return;
      
      let idxActual = 0;
      scrollEl.addEventListener('scroll', () => {
        const newIdx = Math.round(scrollEl.scrollLeft / scrollEl.clientWidth);
        if (newIdx !== idxActual) {
          idxActual = newIdx;
          dots.forEach((d, i) => {
            d.style.backgroundColor = i === idxActual ? d.dataset.color : 'var(--line)';
          });
        }
      });

      timerConsejo = setInterval(() => {
        idxActual = (idxActual + 1) % consejos.length;
        scrollEl.scrollTo({ left: scrollEl.clientWidth * idxActual, behavior: 'smooth' });
      }, 15000);
    }, 0);
  }
}

/* ---------- Bloques ---------- */

function cabecera(sem) {
  const nombre = S.perfil?.nombre?.trim();
  const etiqueta = enDeload() ? '<span class="tag warn">Descarga</span>'
    : enCalibracion() ? `<span class="tag accent">Calibración ${Math.max(1, sem)}/${SEMANAS_CALIBRACION}</span>`
      : `<span class="tag">Semana ${sem}</span>`;
  return `
    <div class="row" style="align-items:flex-start;justify-content:space-between">
      <div>
        <h2 class="page-title" style="font-size: 2rem;">Hola${nombre ? `, ${esc(nombre)}` : ''}</h2>
        <p class="page-sub mb0">${fechaCorta(hoyISO())} · Aquí está tu resumen de hoy.</p>
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
  const isInfo = (c.titulo.toLowerCase().includes('medir') || c.tono === 'info');
  const etiqueta = isInfo ? 'INFO' : 'CONSEJO';
  const colorAccent = 'var(--accent)';

  const cardStyle = isInfo 
    ? `background: ${colorAccent}; color: #fff; border:none; position:relative; margin:0; height:100%;`
    : `border-left: 3px solid ${colorAccent}; position:relative; margin:0; height:100%;`;
  
  const eyebrowStyle = isInfo ? `color: #000; font-weight: 600;` : `color: ${colorAccent};`;
  const titleStyle = isInfo ? `margin-right: 70px; color: #000;` : `margin-right: 70px;`;
  const textClass = isInfo ? `small mb0` : `muted small mb0`;
  const tagStyle = isInfo 
    ? `background: #000; color: #fff; border: none;` 
    : `background: var(--bg-alt); color: var(--text);`;

  return `
    <div class="card" style="${cardStyle}">
      <div class="eyebrow" style="${eyebrowStyle}">El entrenador dice</div>
      <h3 style="${titleStyle}">${esc(c.titulo)}</h3>
      <p class="${textClass}">${esc(c.texto)}</p>
      
      <div style="position:absolute; top: 12px; right: 12px;">
        <span class="tag" style="${tagStyle}">${etiqueta}</span>
      </div>
    </div>`;
}

function tarjetaSesion(rutina, dia) {
  if (!rutina || !dia) {
    const esNovato = S.perfil?.experiencia === 'novato';
    return `
      <div class="card accent glow">
        <div class="eyebrow">Primer Paso</div>
        <h3>${esNovato ? 'Tu rutina lista' : 'Configurar rutina'}</h3>
        <p class="muted small">${esNovato 
          ? 'Como nos dijiste que eres nuevo, he preparado una rutina desde cero para ti.' 
          : 'Vamos a configurar la rutina que ya haces o, si eres nuevo, crear una para ti.'}</p>
        <button class="btn primary block lg mt" data-act="wizard">${esNovato ? 'Empezar a entrenar' : 'Configurar entreno'}</button>
      </div>`;
  }
  const ultima = S.sesiones.filter((s) => s.diaId === dia.id).at(-1);
  const desde = ultima ? diasEntre(ultima.fecha, hoyISO()) : null;
  return `
    <div class="card accent glow">
      <div class="row" style="align-items:flex-start;justify-content:space-between">
        <h3 style="font-size:1.8rem; color: var(--accent); margin-bottom: 0;">${esc(dia.nombre)}</h3>
        <span class="tag">${dia.ejercicios.length} ejercicios</span>
      </div>
      <div class="eyebrow" style="margin-top: 4px; color: var(--text);">Hoy toca</div>
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
