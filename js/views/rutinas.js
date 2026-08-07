/* Rutinas: generador automático y constructor manual sobre el catálogo. */
import { S, guardar, uid, guardarRutina, borrarRutina, rutinaActiva, MAX_SERIES } from '../store.js';
import { acts, on, esc, toast, sheet, confirmar } from '../lib/ui.js';
import { cargar as cargarCatalogo, buscar, gifDe, ejercicio } from '../data/catalog.js';
import { tTarget, tEquipo, equiposDisponibles, CATEGORIAS_EQUIPO, grupoDe } from '../data/i18n.js';
import { generarRutina, rutinaVacia, configDeEjercicio } from '../engine/generator.js';
import { PLANTILLAS } from '../data/splits.js';

let ctx = null;

export async function render(c) {
  ctx = c;
  await cargarCatalogo();
  const [seccion, rid, did] = c.params;
  if (seccion === 'r' && rid) return editorRutina(rid);
  if (seccion === 'd' && rid && did) return editorDia(rid, did);
  return listado();
}

/* ---------- Listado ---------- */

function listado() {
  const activa = S.rutinaActiva;
  ctx.view.innerHTML = `
    <h2 class="page-title">Rutinas</h2>
    <p class="page-sub">La rutina activa es la que manda en la pestaña de entreno.</p>

    <div class="stack">
      ${S.rutinas.length ? S.rutinas.map((r) => `
        <div class="card ${r.id === activa ? 'accent' : ''}" style="margin:0">
          <div class="card-head">
            <h3>${esc(r.nombre)}</h3>
            ${r.id === activa ? '<span class="tag accent">Activa</span>' : ''}
          </div>
          <p class="muted tiny">${r.dias.length} días · ${r.dias.reduce((t, d) => t + d.ejercicios.length, 0)} ejercicios</p>
          <div class="row wrap" style="gap:8px">
            <button class="btn sm ghost" data-act="abrir" data-id="${r.id}">Editar</button>
            ${r.id !== activa ? `<button class="btn sm quiet" data-act="activar" data-id="${r.id}">Activar</button>` : ''}
            <button class="btn sm danger" data-act="borrar" data-id="${r.id}">Borrar</button>
          </div>
        </div>`).join('') : `
        <div class="empty">
          <h3>Todavía no hay rutinas</h3>
          <p class="small">Genera una en dos toques o móntala tú desde cero.</p>
        </div>`}
    </div>

    <div class="stack mt-lg">
      <button class="btn primary block lg" data-act="generar">Generarme una rutina</button>
      <button class="btn ghost block" data-act="vacia">Crear una a mano</button>
    </div>`;

  acts(ctx.view, {
    abrir: (n) => ctx.ir(`/rutinas/r/${n.dataset.id}`),
    activar: (n) => { S.rutinaActiva = n.dataset.id; guardar(); listado(); toast('Rutina activa cambiada', 'ok'); },
    borrar: async (n) => {
      const r = S.rutinas.find((x) => x.id === n.dataset.id);
      if (!await confirmar('Borrar rutina', `Se borra "${r.nombre}". Las sesiones ya guardadas se conservan.`, 'Borrar')) return;
      borrarRutina(n.dataset.id);
      listado();
    },
    generar: () => hojaGenerar(),
    vacia: () => {
      const r = rutinaVacia();
      guardarRutina(r);
      ctx.ir(`/rutinas/r/${r.id}`);
    },
  });
}

function hojaGenerar() {
  let dias = S.perfil?.dias || 3;
  let cats = [...(S.perfil?.categorias || ['barra', 'mancuernas', 'maquinas', 'corporal'])];

  const cuerpo = () => `
    <div class="field">
      <label>Días por semana</label>
      <div class="chips">
        ${[2, 3, 4, 5, 6].map((d) => `<button class="chip ${dias === d ? 'on' : ''}" data-dias="${d}">${d}</button>`).join('')}
      </div>
    </div>
    <div class="card accent" style="margin:0 0 14px">
      <div class="eyebrow">${esc(PLANTILLAS[dias].nombre)}</div>
      <p class="muted small mb0">${esc(PLANTILLAS[dias].descripcion)}</p>
    </div>
    <div class="field">
      <label>Material</label>
      <div class="chips">
        ${CATEGORIAS_EQUIPO.map((c) => `<button class="chip ${cats.includes(c.id) ? 'on' : ''}" data-cat="${c.id}">${esc(c.nombre)}</button>`).join('')}
      </div>
    </div>
    <button class="btn primary block lg" data-crear>Generar</button>`;

  const hoja = sheet({ title: 'Generar rutina', body: cuerpo() });
  const repintar = () => { hoja.body.innerHTML = cuerpo(); };

  hoja.el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dias]');
    if (d) { dias = Number(d.dataset.dias); return repintar(); }
    const c = e.target.closest('[data-cat]');
    if (c) {
      const id = c.dataset.cat;
      cats = cats.includes(id) ? cats.filter((x) => x !== id) : [...cats, id];
      return repintar();
    }
    if (e.target.closest('[data-crear]')) {
      if (!cats.length) return toast('Elige al menos un material', 'bad');
      const r = generarRutina({ dias, categorias: cats });
      guardarRutina(r);
      S.rutinaActiva = r.id;
      guardar();
      hoja.close();
      ctx.ir(`/rutinas/r/${r.id}`);
      toast('Rutina generada', 'ok');
    }
  });
}

/* ---------- Editor de rutina ---------- */

function editorRutina(rid) {
  const r = S.rutinas.find((x) => x.id === rid);
  if (!r) return ctx.ir('/rutinas', true);

  ctx.view.innerHTML = `
    <button class="btn sm quiet" data-act="volver">← Rutinas</button>
    <div class="field mt">
      <label>Nombre de la rutina</label>
      <input class="input" id="nombre" value="${esc(r.nombre)}">
    </div>

    <div class="stack">
      ${r.dias.map((d, i) => `
        <div class="list-item" style="align-items:flex-start">
          <div class="body">
            <b>${esc(d.nombre)}</b>
            <small>${d.ejercicios.length ? d.ejercicios.map((e) => grupoDe(e.target)).filter((v, j, a) => a.indexOf(v) === j).join(' · ') : 'sin ejercicios'}</small>
          </div>
          <div class="row" style="gap:6px;flex:none">
            ${i > 0 ? `<button class="icon-btn" data-act="subirDia" data-i="${i}">↑</button>` : ''}
            <button class="btn sm ghost" data-act="abrirDia" data-id="${d.id}">Abrir</button>
          </div>
        </div>`).join('')}
    </div>

    <button class="btn ghost block mt" data-act="anadirDia">Añadir día</button>
    <div class="divider"></div>
    <button class="btn quiet block" data-act="activar" ${S.rutinaActiva === r.id ? 'disabled' : ''}>
      ${S.rutinaActiva === r.id ? 'Es tu rutina activa' : 'Usar esta rutina'}
    </button>`;

  const guardarNombre = () => {
    const v = ctx.view.querySelector('#nombre').value.trim();
    if (v) { r.nombre = v; guardar(); }
  };

  acts(ctx.view, {
    volver: () => { guardarNombre(); ctx.ir('/rutinas'); },
    abrirDia: (n) => { guardarNombre(); ctx.ir(`/rutinas/d/${r.id}/${n.dataset.id}`); },
    anadirDia: () => {
      r.dias.push({ id: uid(), nombre: `Día ${r.dias.length + 1}`, ejercicios: [] });
      r.diasSemana = r.dias.length;
      guardar();
      editorRutina(rid);
    },
    subirDia: (n) => {
      const i = Number(n.dataset.i);
      [r.dias[i - 1], r.dias[i]] = [r.dias[i], r.dias[i - 1]];
      guardar();
      editorRutina(rid);
    },
    activar: () => { S.rutinaActiva = r.id; guardar(); toast('Rutina activada', 'ok'); editorRutina(rid); },
  });
}

/* ---------- Editor de día ---------- */

function editorDia(rid, did) {
  const r = S.rutinas.find((x) => x.id === rid);
  const d = r?.dias.find((x) => x.id === did);
  if (!d) return ctx.ir('/rutinas', true);

  ctx.view.innerHTML = `
    <button class="btn sm quiet" data-act="volver">← ${esc(r.nombre)}</button>
    <div class="field mt">
      <label>Nombre del día</label>
      <input class="input" id="nombre-dia" value="${esc(d.nombre)}">
    </div>

    <div class="stack">
      ${d.ejercicios.length ? d.ejercicios.map((e, i) => {
    const ex = ejercicio(e.exId);
    return `
        <div class="card" style="margin:0;padding:12px">
          <div class="row" style="gap:11px;align-items:flex-start">
            <img class="thumb" src="${gifDe(ex)}" alt="" loading="lazy" onerror="this.className='thumb ph'">
            <div class="body" style="min-width:0;flex:1">
              <b class="truncate" style="display:block;text-transform:capitalize">${esc(e.nombre)}</b>
              <small class="faint">${esc(tTarget(e.target))} · ${esc(tEquipo(e.equipment))}</small>
            </div>
            <div class="row" style="gap:4px;flex:none">
              ${i > 0 ? `<button class="icon-btn" data-act="subir" data-i="${i}">↑</button>` : ''}
              <button class="icon-btn" data-act="quitar" data-i="${i}">×</button>
            </div>
          </div>
          <div class="row" style="gap:8px;margin-top:10px">
            <div style="flex:1"><label class="tiny faint">Series</label>
              <input class="input num" type="number" inputmode="numeric" data-campo="series" data-i="${i}" value="${e.series}"></div>
            <div style="flex:1"><label class="tiny faint">Reps mín.</label>
              <input class="input num" type="number" inputmode="numeric" data-campo="repMin" data-i="${i}" value="${e.repMin}"></div>
            <div style="flex:1"><label class="tiny faint">Reps máx.</label>
              <input class="input num" type="number" inputmode="numeric" data-campo="repMax" data-i="${i}" value="${e.repMax}"></div>
          </div>
          <div class="row" style="gap:8px;margin-top:8px;align-items:center">
            <span class="tiny faint" style="flex:none">Descanso</span>
            <div class="seg grow">
              ${[60, 90, 120, 180].map((s) => `
                <button data-act="descanso" data-i="${i}" data-s="${s}" class="${e.descanso === s ? 'on' : ''}">${s < 120 ? `${s}s` : `${s / 60}m`}</button>`).join('')}
            </div>
          </div>
        </div>`;
  }).join('') : '<div class="empty"><p class="small">Este día está vacío. Añade ejercicios.</p></div>'}
    </div>

    <button class="btn primary block mt" data-act="anadir">Añadir ejercicio</button>
    <button class="btn danger block mt" data-act="borrarDia">Borrar este día</button>`;

  on(ctx.view, 'change', (e) => {
    const el = e.target.closest('[data-campo]');
    if (!el) return;
    // Las series se topan igual que en el entreno; las reps, en algo sensato.
    const bruto = Math.max(1, Number(el.value) || 1);
    const v = el.dataset.campo === 'series' ? Math.min(MAX_SERIES, bruto) : Math.min(50, bruto);
    if (v !== bruto) {
      el.value = v;
      toast(el.dataset.campo === 'series' ? `Máximo ${MAX_SERIES} series` : 'Máximo 50 reps', 'bad');
    }
    d.ejercicios[Number(el.dataset.i)][el.dataset.campo] = v;
    guardar();
  });

  acts(ctx.view, {
    volver: () => {
      const v = ctx.view.querySelector('#nombre-dia').value.trim();
      if (v) { d.nombre = v; guardar(); }
      ctx.ir(`/rutinas/r/${rid}`);
    },
    subir: (n) => {
      const i = Number(n.dataset.i);
      [d.ejercicios[i - 1], d.ejercicios[i]] = [d.ejercicios[i], d.ejercicios[i - 1]];
      guardar();
      editorDia(rid, did);
    },
    quitar: (n) => { d.ejercicios.splice(Number(n.dataset.i), 1); guardar(); editorDia(rid, did); },
    descanso: (n) => { d.ejercicios[Number(n.dataset.i)].descanso = Number(n.dataset.s); guardar(); editorDia(rid, did); },
    anadir: () => buscadorEjercicios((ex) => {
      d.ejercicios.push(configDeEjercicio(ex, { tipo: 'hipertrofia', series: 3, repMin: 8, repMax: 12 }));
      guardar();
      editorDia(rid, did);
      toast('Añadido');
    }),
    borrarDia: async () => {
      if (!await confirmar('Borrar día', `Se borra "${d.nombre}" de la rutina.`, 'Borrar')) return;
      r.dias = r.dias.filter((x) => x.id !== did);
      guardar();
      ctx.ir(`/rutinas/r/${rid}`);
    },
  });
}

/* ---------- Buscador del catálogo ---------- */

export function buscadorEjercicios(alElegir) {
  const equipos = equiposDisponibles(S.perfil?.categorias || []);
  let soloMio = true;
  let grupo = null;

  const GRUPOS = [
    ['pectorals', 'Pecho'], ['lats', 'Dorsal'], ['upper back', 'Espalda'], ['delts', 'Hombro'],
    ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['quads', 'Cuádriceps'], ['hamstrings', 'Femoral'],
    ['glutes', 'Glúteo'], ['calves', 'Gemelo'], ['abs', 'Core'], ['traps', 'Trapecio'],
  ];

  const item = (o) => `
    <button class="list-item" data-id="${o.id}">
      <img class="thumb" src="${gifDe(o)}" alt="" loading="lazy" onerror="this.className='thumb ph'">
      <div class="body">
        <b class="truncate" style="display:block;text-transform:capitalize">${esc(o.name)}</b>
        <small>${esc(tTarget(o.target))} · ${esc(tEquipo(o.equipment))}</small>
      </div>
    </button>`;

  const hoja = sheet({
    title: 'Añadir ejercicio',
    body: `
      <input class="input" id="q" placeholder="Buscar entre 1.324 ejercicios…" autocomplete="off">
      <div class="chips" style="margin:12px 0" id="grupos">
        <button class="chip on" data-g="">Todos</button>
        ${GRUPOS.map(([g, n]) => `<button class="chip" data-g="${g}">${n}</button>`).join('')}
      </div>
      <label class="switch" style="padding-top:0">
        <span class="small">Solo con mi material</span>
        <span class="switch-track on" id="filtro-mat"></span>
      </label>
      <div id="res" class="stack" style="gap:8px;margin-top:10px"></div>`,
  });

  const q = hoja.el.querySelector('#q');
  const res = hoja.el.querySelector('#res');
  const refrescar = () => {
    const lista = buscar({
      q: q.value.trim(),
      target: grupo || null,
      equipos: soloMio ? equipos : null,
      limite: 40,
    });
    res.innerHTML = lista.length ? lista.map(item).join('') : '<p class="faint small center">Nada con esos filtros.</p>';
  };

  q.addEventListener('input', refrescar);
  hoja.el.querySelector('#grupos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    grupo = b.dataset.g || null;
    hoja.el.querySelectorAll('#grupos .chip').forEach((c) => c.classList.toggle('on', c === b));
    refrescar();
  });
  hoja.el.querySelector('#filtro-mat').addEventListener('click', (e) => {
    soloMio = !soloMio;
    e.currentTarget.classList.toggle('on', soloMio);
    refrescar();
  });
  res.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const ex = ejercicio(b.dataset.id);
    if (ex) { hoja.close(); alElegir(ex); }
  });

  refrescar();
}
