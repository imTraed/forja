/* Arranque y enrutado. Sin framework: cada vista pinta dentro de #view. */
import { S, modoApp, cambiarModo, reemplazarEstado, configurarSincronizacion } from './store.js';
import { sheet, esc } from './lib/ui.js';
import { hayNube, haySesion, descargarEstado, subirEstado, renovar } from './lib/nube.js';
import * as auth from './views/auth.js';
import { $, $$ } from './lib/ui.js';
import { prepararAudio } from './engine/timer.js';

import * as onboarding from './views/onboarding.js';
import * as hoy from './views/hoy.js';
import * as rutinas from './views/rutinas.js';
import * as entreno from './views/entreno.js';
import * as yo from './views/yo.js';
import * as comida from './views/comida.js';
import * as ajustes from './views/ajustes.js';
import * as wizard from './views/wizard.js';
import * as chequeo from './views/chequeo.js';

const VISTAS = { hoy, rutinas, entreno, yo, comida, ajustes, wizard, chequeo };
const view = $('#view');

export function ir(ruta, reemplazar = false) {
  if (reemplazar) location.replace(`#${ruta}`);
  else location.hash = ruta;
}

function partesDeRuta() {
  const h = location.hash.replace(/^#\/?/, '');
  return h ? h.split('/').filter(Boolean) : [];
}

let vistaActual = null;

async function pintar() {
  const partes = partesDeRuta();
  const nombre = partes[0] || 'hoy';

  // Con nube configurada, sin sesión no se pasa de aquí.
  if (hayNube() && !haySesion()) {
    vistaActual?.salir?.();
    vistaActual = auth;
    $('#tabbar').hidden = true;
    $('#topbar').hidden = true;
    await auth.render({ view, ir, params: [] });
    return;
  }

  // Sin perfil no hay app: primero el onboarding.
  if (!S.perfil) {
    vistaActual?.salir?.();
    vistaActual = onboarding;
    $('#tabbar').hidden = true;
    $('#topbar').hidden = true;
    await onboarding.render({ view, ir, params: [] });
    marcarTab(null);
    return;
  }
  $('#tabbar').hidden = false;
  $('#topbar').hidden = false;

  const vista = VISTAS[nombre] || hoy;
  if (vistaActual && vistaActual !== vista) vistaActual.salir?.();
  vistaActual = vista;

  view.scrollTop = 0;
  window.scrollTo(0, 0);
  try {
    await vista.render({ view, ir, params: partes.slice(1) });
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h3>Algo ha fallado</h3><p class="muted small">${e.message}</p></div>`;
  }
  marcarTab(VISTAS[nombre] ? nombre : 'hoy');
  pintarBotonModo();
}

/** Pestañas ocultas en Lite: se llega a ellas desde el menú del botón +. */
const OCULTAS_EN_LITE = ['rutinas', 'comida'];

function marcarTab(nombre) {
  const lite = modoApp() === 'lite';
  $('#tabbar').classList.toggle('lite', lite);

  // En Lite, Rutinas y Comida no tienen pestaña propia: mientras estés en
  // ellas se queda marcado el +, que es desde donde se entra.
  const activa = lite && OCULTAS_EN_LITE.includes(nombre) ? 'entreno' : nombre;
  $$('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === activa));
}

/* ---------- Interruptor de modo, siempre visible en la barra superior ---------- */

function pintarBotonModo() {
  const slot = $('#topbar-right');
  if (!slot) return;
  if (!S.perfil) { slot.innerHTML = ''; return; }
  const modo = modoApp();
  slot.innerHTML = `
    <button class="chip ${modo === 'pro' ? 'on' : ''}" id="btn-modo" style="padding:6px 12px">
      ${modo === 'pro' ? 'PRO' : 'LITE'}
    </button>`;
  $('#btn-modo').onclick = abrirSelectorModo;
}

/**
 * Las dos versiones tienen las mismas pantallas: lo que cambia es cuánto
 * detalle se te pide durante el entreno y de dónde salen los pesos.
 */
export function abrirSelectorModo() {
  const actual = modoApp();
  const opcion = (id, titulo, texto) => `
    <button class="list-item" data-modo="${id}" style="${actual === id ? 'border-color:var(--accent)' : ''}">
      <div class="body"><b>${esc(titulo)}</b><small>${esc(texto)}</small></div>
      ${actual === id ? '<span class="tag accent">Activo</span>' : ''}
    </button>`;

  const hoja = sheet({
    title: 'Versión de la app',
    body: `
      <p class="muted small">Las dos tienen lo mismo: rutinas, progreso, comida y entrenador. Cambia el detalle que te pido mientras entrenas.</p>
      <div class="stack mt">
        ${opcion('lite', 'Lite', 'Te guío ejercicio a ejercicio y controlo los descansos. Los pesos salen de un chequeo de cuatro preguntas una vez por semana.')}
        ${opcion('pro', 'Pro', 'Anotas cada serie con su peso y su esfuerzo. Más trabajo por sesión, pero la progresión se calcula al detalle.')}
      </div>
      <p class="tiny faint mt">Puedes cambiar cuando quieras. No se pierde nada de lo que ya tienes guardado.</p>`,
  });

  hoja.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b) return;
    cambiarModo(b.dataset.modo);
    hoja.close();
    pintarBotonModo();
    pintar();
  });
}

window.addEventListener('hashchange', pintar);

// El audio de los avisos necesita un gesto del usuario para desbloquearse.
document.addEventListener('pointerdown', () => prepararAudio(), { once: true });

/**
 * Al entrar se trae lo que hay en la cuenta. Si en la nube hay algo y aquí no
 * (móvil nuevo, navegador borrado), gana la nube. Si es al revés — te
 * registraste con datos ya hechos en este navegador — se sube lo de aquí.
 * A partir de ahí, cada cambio se sube solo con unos segundos de retardo.
 */
async function arrancarNube() {
  if (!hayNube() || !haySesion()) return;

  await renovar();

  try {
    const remoto = await descargarEstado();
    const hayLocal = Boolean(S.perfil);
    if (remoto?.estado?.v && remoto.estado.perfil) {
      const remotoEsMasNuevo = !hayLocal
        || new Date(remoto.actualizado) > new Date(S.perfil?.creado || 0);
      if (remotoEsMasNuevo) reemplazarEstado(remoto.estado);
    } else if (hayLocal) {
      await subirEstado(S);
    }
  } catch (e) {
    console.warn('No se pudo sincronizar al arrancar:', e.message);
  }

  configurarSincronizacion(async (estado) => {
    try {
      await subirEstado(estado);
    } catch (e) {
      console.warn('No se pudo subir:', e.message);
    }
  });
}

async function arrancar() {
  await arrancarNube();
  await pintar();
  $('#app').hidden = false;
  const boot = $('#boot');
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 400);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      // Si ya había una versión controlando la página, cuando entre una nueva
      // hay que recargar: si no, te quedas usando la app antigua y los cambios
      // no aparecen hasta que borras los datos del navegador a mano.
      const teniaControl = !!navigator.serviceWorker.controller;
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!teniaControl || recargando) return;
        recargando = true;
        location.reload();
      });
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.update();
    } catch { /* sin service worker la app sigue funcionando, pero sin offline */ }
  }
}

window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) return;
  console.error(e.error || e.message);
});

arrancar();

export { pintar };
