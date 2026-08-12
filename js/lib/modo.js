/**
 * Selector de versión Lite/Pro.
 *
 * Vive aparte porque lo usan la pantalla de Hoy y el arranque, y si lo dejaba
 * en app.js se montaba una importación circular.
 */
import { modoApp, cambiarModo } from '../store.js';
import { sheet, esc } from './ui.js';

/**
 * Evento que avisa de que se cambió de versión. Lo escucha el arranque para
 * repintar todo, incluida la barra de pestañas, que en Lite tiene tres y en
 * Pro cinco. Se hace por evento y no llamando a app.js para no montar una
 * importación circular.
 */
export const EVENTO_MODO = 'forja:modo';

/**
 * Las dos versiones tienen las mismas pantallas: lo que cambia es cuánto
 * detalle se pide durante el entreno y de dónde salen los pesos.
 */
export function abrirSelectorModo() {
  const actual = modoApp();

  const opcion = (id, titulo, texto) => `
    <button class="list-item" data-modo="${id}" style="${actual === id ? 'border-color:var(--accent)' : ''}">
      <div class="body"><b>${esc(titulo)}</b><small>${esc(texto)}</small></div>
      ${actual === id ? '<span class="tag accent">Activa</span>' : ''}
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
    window.dispatchEvent(new Event(EVENTO_MODO));
  });
}
