/* Chequeo semanal del modo lite: cuatro números y sigues teniendo progresión. */
import { guardarChequeo, rutinaActiva, ultimoChequeo } from '../store.js';
import { acts, esc, toast, sheet, num, kg, fechaCorta, diasEntre, hoyISO } from '../lib/ui.js';
import { preguntas, aZonas, comparar } from '../engine/chequeo.js';
import { cargar as cargarCatalogo, ejercicio, gifDe } from '../data/catalog.js';
import { tEquipo } from '../data/i18n.js';

let ctx = null;

export async function render(c) {
  ctx = c;
  await cargarCatalogo();
  pintar();
}

function pintar() {
  const rutina = rutinaActiva();
  const lista = preguntas(rutina);
  const previo = ultimoChequeo();
  const desde = previo ? diasEntre(previo.fecha, hoyISO()) : null;

  if (!lista.length) {
    ctx.view.innerHTML = `
      <div class="empty">
        <h3>Sin rutina no hay chequeo</h3>
        <p class="small">Necesito saber qué ejercicios haces para poder preguntarte por ellos.</p>
        <button class="btn primary mt" data-act="rutinas">Crear rutina</button>
      </div>`;
    return acts(ctx.view, { rutinas: () => ctx.ir('/rutinas') });
  }

  ctx.view.innerHTML = `
    <h2 class="page-title">Chequeo semanal</h2>
    <p class="page-sub">
      ${previo
    ? `Último hace ${desde} día${desde === 1 ? '' : 's'}. Dime con cuánto vas ahora y te digo si has subido.`
    : 'Cuatro números y ya puedo medir si progresas. Treinta segundos.'}
    </p>

    <div class="card">
      <p class="small muted mb0">
        Te pregunto solo por el ejercicio más pesado de cada zona. Si esta semana no lo has hecho
        o no te acuerdas, déjalo en blanco: prefiero un hueco a un número inventado.
      </p>
    </div>

    <div class="stack">
      ${lista.map((p) => {
    const ex = ejercicio(p.ej.exId);
    return `
        <div class="card" style="margin:0">
          <div class="row" style="gap:12px;align-items:center">
            <img class="thumb" src="${gifDe(ex)}" alt="" loading="lazy" onerror="this.className='thumb ph'">
            <div style="min-width:0;flex:1">
              <div class="eyebrow mb0">${esc(p.nombre)}</div>
              <b class="small truncate" style="display:block;text-transform:capitalize">${esc(p.ej.nombre)}</b>
              <small class="faint">${esc(tEquipo(p.ej.equipment))} · unas ${p.reps} reps</small>
            </div>
          </div>
          <div class="row" style="gap:8px;margin-top:12px;align-items:center">
            <input class="input num grow respuesta" data-zona="${p.zona}" type="number" inputmode="decimal" step="0.5"
                   value="${p.ultimo ?? ''}" placeholder="—"
                   style="min-height:54px;font-size:1.25rem;text-align:center">
            <span class="muted small" style="flex:none">kg</span>
          </div>
          ${p.ultimo != null
      ? `<p class="tiny faint mb0" style="margin-top:6px">La última vez: ${kg(p.ultimo)}${p.fechaUltimo ? ` (${fechaCorta(p.fechaUltimo)})` : ''}</p>`
      : ''}
        </div>`;
  }).join('')}
    </div>

    <button class="btn primary block lg mt-lg" data-act="guardar">Guardar chequeo</button>
    ${previo ? '<button class="btn quiet block mt" data-act="saltar">Ahora no</button>' : ''}
    <div style="height:24px"></div>`;

  acts(ctx.view, {
    rutinas: () => ctx.ir('/rutinas'),
    saltar: () => ctx.ir('/hoy'),
    guardar: () => {
      const valores = {};
      ctx.view.querySelectorAll('.respuesta').forEach((el) => {
        if (el.value.trim() !== '') valores[el.dataset.zona] = el.value;
      });
      const zonas = aZonas(lista, valores);
      if (!zonas.some((z) => z.peso > 0)) return toast('Rellena al menos una zona', 'bad');

      const cambios = comparar(zonas.filter((z) => z.peso > 0));
      guardarChequeo(zonas);
      mostrarResultado(cambios);
    },
  });
}

function mostrarResultado(cambios) {
  const subidas = cambios.filter((c) => c.delta > 0);
  const bajadas = cambios.filter((c) => c.delta < 0);

  const hoja = sheet({
    title: 'Chequeo guardado',
    body: `
      ${cambios.length ? `
        <div class="stack" style="gap:8px">
          ${cambios.map((c) => `
            <div class="row small" style="justify-content:space-between">
              <span style="text-transform:capitalize" class="truncate">${esc(c.nombre)}</span>
              <span class="mono" style="color:${c.delta > 0 ? 'var(--ok)' : c.delta < 0 ? 'var(--bad)' : 'var(--faint)'}">
                ${num(c.antes)} → ${num(c.ahora)} kg${c.delta ? ` (${c.delta > 0 ? '+' : ''}${num(c.delta)})` : ''}
              </span>
            </div>`).join('')}
        </div>
        <p class="muted small mt">${
  subidas.length
    ? `Has subido en ${subidas.length} de ${cambios.length} zonas. Eso es progresar: sigue así.`
    : bajadas.length
      ? 'Has bajado en alguna zona. Puede ser una mala semana, pero si se repite el mes que viene toca revisar descanso y comida.'
      : 'Todo igual que la semana pasada. Si se repite, hay que forzar la subida: una rep más o un poco más de peso.'
}</p>`
    : '<p class="muted small">Primer chequeo guardado. A partir de la semana que viene ya puedo compararte contigo mismo.</p>'}
      <button class="btn primary block mt" data-cerrar>Listo</button>`,
    onClose: () => ctx.ir('/hoy'),
  });

  hoja.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) hoja.close();
  });
}
