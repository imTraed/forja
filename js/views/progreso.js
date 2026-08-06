/* Progreso: gráficas propias en SVG, volumen semanal e informes del entrenador. */
import {
  S, semanaPrograma, historial, ejerciciosEntrenados, tendenciaPeso, sesionesDeSemana,
} from '../store.js';
import { acts, esc, sheet, num, kg, fechaCorta, duracion } from '../lib/ui.js';
import {
  volumenSemanal, tonelajeSemanal, informeSemanal, informeCalibracionDisponible,
  generarInformeCalibracion, gruposFlojos,
} from '../engine/coach.js';
import { marcas, diagnostico } from '../engine/progression.js';
import { VOLUMEN_OBJETIVO } from '../data/i18n.js';
import { cargar as cargarCatalogo, ejercicio } from '../data/catalog.js';

let ctx = null;

export async function render(c) {
  ctx = c;
  // El volumen indirecto necesita los músculos secundarios del catálogo.
  await cargarCatalogo().catch(() => null);
  const sem = semanaPrograma();
  const ejercicios = ejerciciosEntrenados();

  if (!S.sesiones.length) {
    ctx.view.innerHTML = `
      <h2 class="page-title">Progreso</h2>
      <div class="empty">
        <h3>Aún no hay nada que enseñar</h3>
        <p class="small">Cuando termines tu primera sesión aparecerán aquí tus 1RM estimados, el volumen por músculo y la evolución del peso.</p>
      </div>`;
    return;
  }

  ctx.view.innerHTML = `
    <h2 class="page-title">Progreso</h2>
    <p class="page-sub">Semana ${sem} del programa · ${S.sesiones.length} sesiones registradas.</p>

    ${informeCalibracionDisponible() ? `
      <button class="card accent glow" data-act="generarInforme" style="width:100%;text-align:left">
        <div class="eyebrow">Pendiente</div>
        <h3>Generar informe de calibración</h3>
        <p class="muted small mb0">Ya tengo dos semanas de datos. Toca para ver el resumen y empezar a subir pesos.</p>
      </button>` : ''}

    ${bloqueResumen(sem)}
    ${bloqueInformes()}
    ${bloquePeso()}
    ${bloqueVolumen(sem)}
    ${bloqueEjercicios(ejercicios)}
    ${bloqueHistorial()}`;

  acts(ctx.view, {
    generarInforme: () => { generarInformeCalibracion(); render(ctx); },
    verEjercicio: (n) => detalleEjercicio(n.dataset.id),
    verInforme: (n) => verInforme(n.dataset.id),
    verSesion: (n) => detalleSesion(n.dataset.id),
  });
}

/* ---------- Bloques ---------- */

function bloqueResumen(sem) {
  const estaSemana = sesionesDeSemana(sem);
  const ton = tonelajeSemanal(sem);
  const totalSeries = estaSemana.reduce((t, s) => t + s.ejercicios.reduce((u, e) => u + e.sets.length, 0), 0);
  return `
    <div class="stat-grid">
      <div class="stat hi"><b>${estaSemana.length}</b><span>sesiones esta semana</span></div>
      <div class="stat"><b>${totalSeries}</b><span>series</span></div>
      <div class="stat"><b>${ton >= 1000 ? `${num(ton / 1000)}t` : Math.round(ton)}</b><span>kg movidos</span></div>
    </div>`;
}

function bloqueInformes() {
  const informes = S.coach.informes || [];
  const semanal = informeSemanal();
  if (!informes.length && !semanal) return '';
  return `
    <div class="card mt">
      <div class="card-head"><h3>Informes</h3></div>
      ${semanal ? `
        <div class="stack" style="gap:8px;margin-bottom:12px">
          <div class="eyebrow mb0">Semana ${semanal.sem} · ${semanal.sesiones}/${semanal.previstas || '—'} sesiones</div>
          ${semanal.avisos.slice(0, 3).map((a) => `
            <p class="small mb0" style="color:${{ ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)' }[a.tono] || 'var(--text)'}">${esc(a.texto)}</p>`).join('')
    || '<p class="small muted mb0">Semana limpia: volumen en rango y sin ejercicios estancados.</p>'}
        </div>` : ''}
      ${informes.map((i) => `
        <button class="list-item" data-act="verInforme" data-id="${i.id}">
          <div class="body"><b>${esc(i.titulo)}</b><small>${fechaCorta(i.fecha)}</small></div>
          <span class="tiny faint">ver</span>
        </button>`).join('')}
    </div>`;
}

function bloquePeso() {
  if (S.peso.length < 2) return '';
  const t = tendenciaPeso();
  const puntos = S.peso.slice(-60);
  return `
    <div class="card">
      <div class="card-head">
        <h3>Peso corporal</h3>
        ${t ? `<span class="tag ${t.porSemana > 0 ? 'ok' : 'warn'}">${t.porSemana > 0 ? '+' : ''}${num(t.porSemana)} kg/sem</span>` : ''}
      </div>
      ${grafica(puntos.map((p) => ({ x: p.fecha, y: p.kg })), 'kg')}
    </div>`;
}

function bloqueVolumen(sem) {
  const vol = volumenSemanal(sem);
  const entradas = Object.entries(VOLUMEN_OBJETIVO)
    .map(([g, [min, max]]) => ({ g, min, max, n: vol[g] || 0 }))
    .filter((e) => e.n > 0 || e.min >= 6)
    .sort((a, b) => b.n - a.n);
  if (!entradas.length) return '';

  return `
    <div class="card">
      <div class="card-head">
        <h3>Volumen de la semana</h3>
        <span class="tag">series por grupo</span>
      </div>
      <div class="stack" style="gap:11px">
        ${entradas.map((e) => {
    const pct = Math.min(100, (e.n / e.max) * 100);
    const clase = e.n < e.min ? 'bad' : e.n > e.max ? '' : 'ok';
    return `
          <div>
            <div class="row small" style="justify-content:space-between">
              <span style="text-transform:capitalize">${esc(e.g)}</span>
              <span class="mono faint">${num(e.n)} <span style="opacity:.5">/ ${e.min}-${e.max}</span></span>
            </div>
            <div class="bar ${clase}" style="margin-top:4px"><i style="width:${pct}%"></i></div>
          </div>`;
  }).join('')}
      </div>
      ${gruposFlojos(vol).length ? `<p class="tiny faint" style="margin-top:12px">En rojo, los grupos por debajo del mínimo semanal útil.</p>` : ''}
    </div>`;
}

function bloqueEjercicios(ejercicios) {
  if (!ejercicios.length) return '';
  const filas = ejercicios.map(({ exId, nombre }) => {
    const h = historial(exId);
    const m = marcas(h);
    const d = diagnostico(h);
    return { exId, nombre, m, d, sesiones: h.length };
  }).filter((r) => r.m);

  return `
    <div class="card">
      <div class="card-head"><h3>Tus ejercicios</h3></div>
      <div class="stack" style="gap:8px">
        ${filas.map((r) => `
          <button class="list-item" data-act="verEjercicio" data-id="${r.exId}" style="padding:11px 12px;margin:0">
            <div class="body">
              <b class="truncate" style="display:block;text-transform:capitalize">${esc(r.nombre)}</b>
              <small>${r.sesiones} sesiones · 1RM est. ${kg(r.m.e1rm)}</small>
            </div>
            ${r.d.estancado
    ? '<span class="tag bad">estancado</span>'
    : r.m.progresoPct > 1 ? `<span class="tag ok">+${num(r.m.progresoPct)} %</span>` : ''}
          </button>`).join('')}
      </div>
    </div>`;
}

function bloqueHistorial() {
  const ult = S.sesiones.slice(-8).reverse();
  return `
    <div class="card">
      <div class="card-head"><h3>Últimas sesiones</h3></div>
      <div class="stack" style="gap:8px">
        ${ult.map((s) => {
    const series = s.ejercicios.reduce((t, e) => t + e.sets.length, 0);
    return `
          <button class="list-item" data-act="verSesion" data-id="${s.id}" style="padding:11px 12px;margin:0">
            <div class="body">
              <b>${esc(s.nombre)}</b>
              <small>${fechaCorta(s.fecha)} · ${series} series${s.duracion ? ` · ${duracion(s.duracion)}` : ''}</small>
            </div>
          </button>`;
  }).join('')}
      </div>
    </div>`;
}

/* ---------- Gráfica SVG ---------- */

/** Línea simple con área, sin librerías. `puntos` = [{x: etiqueta, y: valor}]. */
function grafica(puntos, unidad = '') {
  if (puntos.length < 2) return '<p class="faint small">Faltan datos para la gráfica.</p>';
  const W = 320;
  const H = 110;
  const pad = 6;
  const ys = puntos.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const rango = max - min || 1;
  const px = (i) => pad + (i / (puntos.length - 1)) * (W - pad * 2);
  const py = (v) => H - pad - ((v - min) / rango) * (H - pad * 2);

  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${px(puntos.length - 1).toFixed(1)},${H} L${px(0).toFixed(1)},${H} Z`;

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".28"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#g-area)" stroke="none"/>
      <path d="${d}" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"/>
      <circle cx="${px(puntos.length - 1)}" cy="${py(puntos.at(-1).y)}" r="3" fill="var(--accent)" stroke="none"/>
    </svg>
    <div class="row" style="justify-content:space-between;margin-top:4px">
      <span class="tiny faint">${esc(fechaCorta(puntos[0].x))} · ${num(puntos[0].y)} ${unidad}</span>
      <span class="tiny" style="color:var(--accent)">${esc(fechaCorta(puntos.at(-1).x))} · ${num(puntos.at(-1).y)} ${unidad}</span>
    </div>`;
}

/* ---------- Detalles ---------- */

async function detalleEjercicio(exId) {
  await cargarCatalogo();
  const ex = ejercicio(exId);
  const h = historial(exId);
  const m = marcas(h);
  const d = diagnostico(h);

  sheet({
    title: ex?.name || 'Ejercicio',
    body: `
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat hi"><b>${num(m.e1rm)}</b><span>1RM est.</span></div>
        <div class="stat"><b>${num(m.pesoMax)}</b><span>peso máx.</span></div>
        <div class="stat"><b>${m.progresoPct > 0 ? '+' : ''}${num(m.progresoPct)}%</b><span>desde el inicio</span></div>
      </div>
      ${d.estancado ? `<p class="small" style="color:var(--bad)">Tres sesiones sin mover el 1RM estimado. Toca descarga o cambio de ejercicio.</p>` : ''}
      ${grafica(h.map((s) => ({ x: s.fecha, y: s.e1rm })), 'kg')}
      <div class="divider"></div>
      <div class="eyebrow">Sesión a sesión</div>
      <div class="stack" style="gap:7px">
        ${h.slice().reverse().slice(0, 12).map((s) => `
          <div class="row small" style="justify-content:space-between">
            <span class="faint">${fechaCorta(s.fecha)}</span>
            <span class="mono">${s.sets.map((x) => `${num(x.peso)}×${x.reps}`).join(' · ')}</span>
          </div>`).join('')}
      </div>`,
  });
}

function verInforme(id) {
  const i = S.coach.informes.find((x) => x.id === id);
  if (!i) return;
  sheet({
    title: i.titulo,
    body: `
      <p class="muted small">${fechaCorta(i.fecha)} · ${i.sesiones} sesiones${i.previstas ? ` de ${i.previstas}` : ''}</p>
      <div class="stack" style="gap:10px;margin:14px 0">
        ${i.notas.map((n) => `<p class="small mb0" style="border-left:2px solid var(--accent);padding-left:10px">${esc(n)}</p>`).join('')}
      </div>
      <div class="eyebrow">Tus marcas de partida</div>
      <div class="stack" style="gap:7px;margin-bottom:16px">
        ${i.ejercicios.slice(0, 12).map((e) => `
          <div class="row small" style="justify-content:space-between">
            <span class="truncate" style="text-transform:capitalize">${esc(e.nombre)}</span>
            <span class="mono" style="color:var(--accent)">${num(e.e1rm)} kg</span>
          </div>`).join('')}
      </div>
      <div class="eyebrow">Series por semana</div>
      <div class="stack" style="gap:5px">
        ${Object.entries(i.volumen).sort((a, b) => b[1] - a[1]).map(([g, n]) => `
          <div class="row small" style="justify-content:space-between">
            <span style="text-transform:capitalize">${esc(g)}</span><span class="mono faint">${num(n)}</span>
          </div>`).join('')}
      </div>`,
  });
}

function detalleSesion(id) {
  const s = S.sesiones.find((x) => x.id === id);
  if (!s) return;
  sheet({
    title: s.nombre,
    body: `
      <p class="muted small">${fechaCorta(s.fecha)}${s.duracion ? ` · ${duracion(s.duracion)}` : ''}</p>
      <div class="stack" style="gap:12px;margin-top:12px">
        ${s.ejercicios.map((e) => `
          <div>
            <b class="small" style="text-transform:capitalize">${esc(e.nombre)}</b>
            <div class="stack" style="gap:3px;margin-top:5px">
              ${e.sets.map((x, i) => `
                <div class="row tiny" style="justify-content:space-between">
                  <span class="faint">Serie ${i + 1}</span>
                  <span class="mono">${num(x.peso)} kg × ${x.reps}${x.rir != null ? ` · RIR ${x.rir}` : ''}</span>
                </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`,
  });
}
