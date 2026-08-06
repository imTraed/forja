/* Utilidades de interfaz: render, hojas inferiores, avisos y formato. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto para interpolar en plantillas sin abrir un XSS con datos propios. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const oyentes = new WeakMap();

/**
 * Un único listener por elemento y tipo de evento.
 *
 * Las vistas se repintan sustituyendo el innerHTML de #view, que es siempre el
 * mismo nodo: sin esto, cada repintado añadiría otro listener y un solo toque
 * acabaría ejecutando la acción decenas de veces.
 */
export function on(root, evento, fn) {
  const mapa = oyentes.get(root) || {};
  if (mapa[evento]) root.removeEventListener(evento, mapa[evento]);
  root.addEventListener(evento, fn);
  mapa[evento] = fn;
  oyentes.set(root, mapa);
}

/** Delegación de clics: cualquier elemento con data-act dispara handlers[act]. */
export function acts(root, handlers) {
  on(root, 'click', (e) => {
    const node = e.target.closest('[data-act]');
    if (!node || !root.contains(node)) return;
    const fn = handlers[node.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(node, e);
  });
}

let toastTimer;
export function toast(msg, kind = '') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  root.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

/**
 * Hoja inferior. `body` es HTML; devuelve { el, close } para que quien la abre
 * enganche sus propios eventos dentro.
 */
export function sheet({ title = '', body = '', onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `
    <div class="sheet">
      <div class="sheet-grip"></div>
      ${title ? `<h3>${esc(title)}</h3>` : ''}
      <div class="sheet-body">${body}</div>
    </div>`;
  const close = () => {
    back.remove();
    onClose?.();
  };
  back.addEventListener('click', (e) => {
    if (e.target === back) close();
  });
  $('#sheet-root').appendChild(back);
  return { el: back, body: $('.sheet-body', back), close };
}

/** Confirmación con dos botones. Resuelve a true/false. */
export function confirmar(title, texto, okLabel = 'Confirmar', peligro = true) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet({
      title,
      body: `
        <p class="muted small">${esc(texto)}</p>
        <div class="stack mt">
          <button class="btn ${peligro ? 'danger' : 'primary'} block" data-ok>${esc(okLabel)}</button>
          <button class="btn quiet block" data-no>Cancelar</button>
        </div>`,
      onClose: () => { if (!done) resolve(false); },
    });
    s.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-ok]')) { done = true; s.close(); resolve(true); }
      if (e.target.closest('[data-no]')) { done = true; s.close(); resolve(false); }
    });
  });
}

/* ---------- Formato ---------- */

export const hoyISO = () => new Date().toLocaleDateString('sv');    // YYYY-MM-DD local
export const isoDe = (d) => new Date(d).toLocaleDateString('sv');

export function fechaCorta(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function diasEntre(a, b) {
  const ms = new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`);
  return Math.round(ms / 86400000);
}

/** 1.5 -> "1,5"  ·  60 -> "60" */
export function num(n, dec = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  const r = Math.round(n * 10 ** dec) / 10 ** dec;
  return String(r).replace('.', ',');
}

export function kg(n) {
  return n == null ? '—' : `${num(n)} kg`;
}

export function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function duracion(ms) {
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** Redondea al múltiplo de `paso` más cercano (2,5 kg de la barra, etc.). */
export function alPaso(peso, paso) {
  if (!paso) return Math.round(peso * 2) / 2;
  return Math.round(peso / paso) * paso;
}
