/* Arranque y enrutado. Sin framework: cada vista pinta dentro de #view. */
import { S } from './store.js';
import { $, $$ } from './lib/ui.js';
import { prepararAudio } from './engine/timer.js';

import * as onboarding from './views/onboarding.js';
import * as hoy from './views/hoy.js';
import * as rutinas from './views/rutinas.js';
import * as entreno from './views/entreno.js';
import * as progreso from './views/progreso.js';
import * as comida from './views/comida.js';
import * as ajustes from './views/ajustes.js';

const VISTAS = { hoy, rutinas, entreno, progreso, comida, ajustes };
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

  // Sin perfil no hay app: primero el onboarding.
  if (!S.perfil) {
    vistaActual?.salir?.();
    vistaActual = onboarding;
    $('#tabbar').hidden = true;
    await onboarding.render({ view, ir, params: [] });
    marcarTab(null);
    return;
  }
  $('#tabbar').hidden = false;

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
}

function marcarTab(nombre) {
  $$('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === nombre));
}

window.addEventListener('hashchange', pintar);

// El audio de los avisos necesita un gesto del usuario para desbloquearse.
document.addEventListener('pointerdown', () => prepararAudio(), { once: true });

async function arrancar() {
  await pintar();
  $('#app').hidden = false;
  const boot = $('#boot');
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 400);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch { /* sin service worker la app sigue funcionando, pero sin offline */ }
  }
}

window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) return;
  console.error(e.error || e.message);
});

arrancar();

export { pintar };
