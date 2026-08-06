/* Ajustes: perfil, incrementos, descansos, GIFs sin conexión y respaldo. */
import { S, guardar, exportar, importar, rutinaActiva, semanaPrograma } from '../store.js';
import { acts, on, esc, toast, confirmar } from '../lib/ui.js';
import { CATEGORIAS_EQUIPO } from '../data/i18n.js';
import { FACTOR_ACTIVIDAD, OBJETIVOS } from '../engine/nutrition.js';
import { cargar as cargarCatalogo, ejercicio, gifDe, imagenDe } from '../data/catalog.js';

const CACHE_MEDIA = 'forja-media-v1';
let ctx = null;

export async function render(c) {
  ctx = c;
  pintar();
}

function pintar() {
  const p = S.perfil;
  const a = S.ajustes;

  ctx.view.innerHTML = `
    <h2 class="page-title">Ajustes</h2>
    <p class="page-sub">Semana ${semanaPrograma()} · ${S.sesiones.length} sesiones guardadas.</p>

    <div class="card">
      <div class="card-head"><h3>Perfil</h3></div>
      <div class="field"><label>Nombre</label>
        <input class="input" data-campo="nombre" value="${esc(p.nombre || '')}" placeholder="Como quieras que te llame"></div>
      <div class="row">
        <div class="field grow"><label>Edad</label>
          <input class="input num" type="number" inputmode="numeric" data-campo="edad" value="${p.edad}"></div>
        <div class="field grow"><label>Altura (cm)</label>
          <input class="input num" type="number" inputmode="numeric" data-campo="altura" value="${p.altura}"></div>
      </div>
      <div class="field"><label>Objetivo</label>
        <select class="input" data-campo="objetivo">
          ${Object.entries(OBJETIVOS).map(([id, o]) => `<option value="${id}" ${p.objetivo === id ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Actividad diaria</label>
        <select class="input" data-campo="actividad">
          ${Object.entries(FACTOR_ACTIVIDAD).map(([id, f]) => `<option value="${id}" ${p.actividad === id ? 'selected' : ''}>${esc(f.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="field mb0"><label>Material disponible</label>
        <div class="chips">
          ${CATEGORIAS_EQUIPO.map((c) => `
            <button class="chip ${(p.categorias || []).includes(c.id) ? 'on' : ''}" data-act="material" data-id="${c.id}">${esc(c.nombre)}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Incremento de peso</h3></div>
      <p class="muted tiny">De cuánto en cuánto puedo subirte con cada material. Ponlo según los discos y mancuernas de tu gimnasio.</p>
      ${[['barbell', 'Barra'], ['dumbbell', 'Mancuernas (por mancuerna)'], ['machine', 'Máquinas'], ['cable', 'Poleas'], ['otro', 'Otros']].map(([k, n]) => `
        <div class="row" style="align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line)">
          <span class="small">${n}</span>
          <input class="input num" style="width:100px;min-height:42px;text-align:center" type="number" inputmode="decimal" step="0.5"
                 data-inc="${k}" value="${a.incrementos[k]}">
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h3>Descansos por defecto</h3></div>
      ${[['fuerza', 'Básicos pesados'], ['hipertrofia', 'Trabajo principal'], ['accesorio', 'Accesorios']].map(([k, n]) => `
        <div class="row" style="align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line)">
          <span class="small">${n}</span>
          <div class="seg" style="flex:none;width:200px">
            ${[60, 90, 120, 180].map((s) => `<button data-act="descanso" data-k="${k}" data-s="${s}" class="${a.descanso[k] === s ? 'on' : ''}">${s < 120 ? `${s}s` : `${s / 60}m`}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h3>Durante el entreno</h3></div>
      <div class="switch"><span class="small">Pitido al acabar el descanso</span>
        <span class="switch-track ${a.sonido ? 'on' : ''}" data-act="toggle" data-k="sonido"></span></div>
      <div class="switch"><span class="small">Vibración</span>
        <span class="switch-track ${a.vibrar ? 'on' : ''}" data-act="toggle" data-k="vibrar"></span></div>
      <div class="switch"><span class="small">Mantener la pantalla encendida</span>
        <span class="switch-track ${a.pantallaActiva ? 'on' : ''}" data-act="toggle" data-k="pantallaActiva"></span></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Sin conexión</h3></div>
      <p class="muted small">Descarga las animaciones de los ejercicios de tu rutina para verlas en el gimnasio aunque no tengas datos.</p>
      <button class="btn ghost block" data-act="precache">Descargar GIFs de mi rutina</button>
      <div id="precache-estado" class="tiny faint center" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Tus datos</h3></div>
      <p class="muted small">Todo vive en este navegador. Si borras los datos del navegador o cambias de móvil, se pierde: exporta de vez en cuando.</p>
      <div class="stack">
        <button class="btn ghost block" data-act="exportar">Exportar respaldo (.json)</button>
        <label class="btn quiet block" style="cursor:pointer">
          Importar respaldo
          <input type="file" accept="application/json" id="fichero" hidden>
        </label>
        <button class="btn danger block" data-act="reiniciar">Empezar de cero</button>
      </div>
    </div>

    <p class="tiny faint center mt">FORJA · datos de ejercicios de hasaneyldrm/exercises-dataset · animaciones © gymvisual.com</p>`;

  on(ctx.view, 'change', alCambiarCampo);
  ctx.view.querySelector('#fichero').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await importar(f);
      toast('Respaldo importado', 'ok');
      location.reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  acts(ctx.view, {
    material: (n) => {
      const cats = S.perfil.categorias || [];
      S.perfil.categorias = cats.includes(n.dataset.id) ? cats.filter((x) => x !== n.dataset.id) : [...cats, n.dataset.id];
      guardar();
      pintar();
    },
    descanso: (n) => { S.ajustes.descanso[n.dataset.k] = Number(n.dataset.s); guardar(); pintar(); },
    toggle: (n) => { S.ajustes[n.dataset.k] = !S.ajustes[n.dataset.k]; guardar(); pintar(); },
    exportar: () => { exportar(); toast('Respaldo descargado', 'ok'); },
    precache: (n) => precargarMedia(n),
    reiniciar: async () => {
      if (!await confirmar('Empezar de cero', 'Se borra todo: perfil, rutinas, sesiones, pesos y plan de comidas. No hay vuelta atrás. Exporta antes si quieres conservarlo.', 'Borrar todo')) return;
      localStorage.clear();
      location.reload();
    },
  });
}

function alCambiarCampo(e) {
  const campo = e.target.closest('[data-campo]');
  if (campo) {
    const v = campo.type === 'number' ? Number(campo.value) : campo.value;
    S.perfil[campo.dataset.campo] = v;
    guardar();
    return;
  }
  const inc = e.target.closest('[data-inc]');
  if (inc) {
    S.ajustes.incrementos[inc.dataset.inc] = Math.max(0, Number(inc.value) || 0);
    guardar();
    toast('Incremento actualizado');
  }
}

/** Mete en la caché del navegador las imágenes de la rutina activa. */
async function precargarMedia(boton) {
  const estado = ctx.view.querySelector('#precache-estado');
  const rutina = rutinaActiva();
  if (!rutina) return toast('No hay rutina activa', 'bad');
  if (!('caches' in window)) return toast('Tu navegador no permite guardar en caché', 'bad');

  boton.disabled = true;
  try {
    await cargarCatalogo();
    const urls = [...new Set(rutina.dias.flatMap((d) => d.ejercicios).flatMap((e) => {
      const ex = ejercicio(e.exId);
      return ex ? [gifDe(ex), imagenDe(ex)] : [];
    }).filter(Boolean))];

    const cache = await caches.open(CACHE_MEDIA);
    let ok = 0;
    for (const [i, url] of urls.entries()) {
      estado.textContent = `Descargando ${i + 1} de ${urls.length}…`;
      try {
        const r = await fetch(url, { mode: 'cors' });
        if (r.ok) { await cache.put(url, r.clone()); ok++; }
      } catch { /* si falla una, seguimos con el resto */ }
    }
    estado.textContent = `${ok} de ${urls.length} archivos guardados para usar sin conexión.`;
    toast('Listo para el gimnasio', 'ok');
  } catch (e) {
    estado.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
}
