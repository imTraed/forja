/* Comida: objetivos calculados, plan con cantidades y checklist del día. */
import { S } from '../store.js';
import { acts, esc, toast, sheet, num, hoyISO } from '../lib/ui.js';
import {
  cargarAlimentos, alimento, alimentos, objetivos, generarPlan, guardarPlan,
  marcarComida, comidasHechas, ingeridoHoy, revisarAjuste, aplicarAjuste, macrosDe,
  FACTOR_ACTIVIDAD, OBJETIVOS,
} from '../engine/nutrition.js';

let ctx = null;

export async function render(c) {
  ctx = c;
  await cargarAlimentos();
  pintar();
}

function pintar() {
  const obj = objetivos();
  const plan = S.comida.plan;
  const hecho = comidasHechas();
  const comido = ingeridoHoy();

  ctx.view.innerHTML = `
    <h2 class="page-title">Comida</h2>
    <p class="page-sub">${OBJETIVOS[S.perfil.objetivo].nombre} · ${obj.kcal} kcal al día${obj.ajusteManual ? ` (${obj.ajusteManual > 0 ? '+' : ''}${obj.ajusteManual} ajustadas)` : ''}</p>

    ${tarjetaMacros(obj, comido)}

    ${plan ? planDelDia(plan, hecho) : `
      <div class="card accent">
        <h3>Sin plan de comidas</h3>
        <p class="muted small">Te monto las comidas del día con cantidades concretas para cuadrar esos macros. Puedes cambiar cualquier alimento después.</p>
        <button class="btn primary block" data-act="generar">Crear mi plan</button>
      </div>`}

    <div class="card">
      <div class="card-head"><h3>Cómo salen estos números</h3></div>
      <div class="stack" style="gap:6px">
        <div class="row small" style="justify-content:space-between"><span class="muted">Metabolismo basal</span><span class="mono">${obj.basal} kcal</span></div>
        <div class="row small" style="justify-content:space-between"><span class="muted">Gasto con actividad ${esc(FACTOR_ACTIVIDAD[S.perfil.actividad].nombre.toLowerCase())}</span><span class="mono">${obj.gasto} kcal</span></div>
        <div class="row small" style="justify-content:space-between"><span class="muted">Objetivo ${esc(OBJETIVOS[S.perfil.objetivo].nombre.toLowerCase())}</span><span class="mono">${obj.objetivo.ajuste > 0 ? '+' : ''}${Math.round(obj.objetivo.ajuste * 100)} %</span></div>
        <div class="row small" style="justify-content:space-between"><span class="muted">Peso usado</span><span class="mono">${num(obj.peso)} kg</span></div>
      </div>
      <button class="btn ghost block mt" data-act="revisar">Revisar mis calorías</button>
    </div>

    ${plan ? '<button class="btn quiet block" data-act="compra">Lista de la compra semanal</button>' : ''}
    <button class="btn quiet block mt" data-act="regenerar" ${plan ? '' : 'hidden'}>Rehacer el plan</button>`;

  acts(ctx.view, {
    generar: () => elegirComidas(),
    regenerar: () => elegirComidas(),
    marcar: (n) => {
      const id = n.dataset.id;
      marcarComida(hoyISO(), id, !hecho[id]);
      pintar();
    },
    cambiarAlimento: (n) => cambiarAlimento(n.dataset.comida, n.dataset.rol),
    revisar: () => revisarCalorias(),
    compra: () => listaCompra(),
    detalleComida: (n) => detalleComida(n.dataset.id),
  });
}

/* ---------- Bloques ---------- */

function tarjetaMacros(obj, comido) {
  const fila = (etiqueta, hecho, meta, unidad) => {
    const pct = Math.min(100, (hecho / meta) * 100);
    return `
      <div>
        <div class="row small" style="justify-content:space-between">
          <span>${etiqueta}</span>
          <span class="mono faint">${Math.round(hecho)} / ${meta} ${unidad}</span>
        </div>
        <div class="bar ${pct >= 90 ? 'ok' : ''}" style="margin-top:4px"><i style="width:${pct}%"></i></div>
      </div>`;
  };
  return `
    <div class="card accent">
      <div class="card-head">
        <h3>Hoy llevas</h3>
        <span class="tag accent">${Math.round(comido.kcal)} kcal</span>
      </div>
      <div class="stack" style="gap:11px">
        ${fila('Calorías', comido.kcal, obj.kcal, 'kcal')}
        ${fila('Proteína', comido.p, obj.proteina, 'g')}
        ${fila('Carbohidratos', comido.c, obj.carbo, 'g')}
        ${fila('Grasas', comido.g, obj.grasa, 'g')}
      </div>
    </div>`;
}

function planDelDia(plan, hecho) {
  return `
    <div class="card">
      <div class="card-head">
        <h3>Plan del día</h3>
        <span class="tag">${plan.comidas.filter((c) => hecho[c.id]).length}/${plan.comidas.length}</span>
      </div>
      <div class="stack" style="gap:10px">
        ${plan.comidas.map((c) => `
          <div class="card" style="margin:0;padding:12px;${hecho[c.id] ? 'border-color:var(--ok)' : ''}">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div>
                <b class="small">${esc(c.nombre)}</b>
                <div class="tiny faint">${esc(c.hora)} · ${Math.round(c.macros.kcal)} kcal · ${Math.round(c.macros.p)} g prot.</div>
              </div>
              <button class="icon-btn" data-act="marcar" data-id="${c.id}"
                      style="${hecho[c.id] ? 'border-color:var(--ok);color:var(--ok)' : ''}">
                ${hecho[c.id] ? '✓' : ''}
              </button>
            </div>
            <div class="stack" style="gap:4px;margin-top:9px">
              ${c.items.map((it) => {
    const a = alimento(it.id);
    return `<div class="row tiny" style="justify-content:space-between">
                  <span>${esc(a?.nombre || it.id)}</span>
                  <span class="mono faint">${it.gramos} ${a?.unidad || 'g'}${porcionTexto(a, it.gramos)}</span>
                </div>`;
  }).join('')}
            </div>
            <div class="row wrap" style="gap:6px;margin-top:10px">
              <button class="btn sm quiet" data-act="cambiarAlimento" data-comida="${c.id}" data-rol="proteina">Cambiar proteína</button>
              <button class="btn sm quiet" data-act="cambiarAlimento" data-comida="${c.id}" data-rol="carbo">Cambiar carbo</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

/** "120 g (1 plátano)" cuando el alimento tiene porción natural. */
function porcionTexto(a, gramos) {
  if (!a?.porcion) return '';
  const n = gramos / a.porcion;
  if (n < 0.4) return '';
  const redondeado = Math.round(n * 2) / 2;
  return ` · ${num(redondeado, 1)} ${esc(a.porcionNombre)}${redondeado === 1 ? '' : 's'}`;
}

/* ---------- Acciones ---------- */

function elegirComidas() {
  const actual = S.comida.plan?.nComidas || 4;
  const hoja = sheet({
    title: '¿Cuántas comidas haces al día?',
    body: `
      <p class="muted small">Da igual el número mientras cuadren los macros del día. Elige el que encaje con tus horarios.</p>
      <div class="chips" style="margin:14px 0">
        ${[2, 3, 4, 5].map((n) => `<button class="chip ${n === actual ? 'on' : ''}" data-n="${n}">${n} comidas</button>`).join('')}
      </div>`,
  });
  hoja.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const plan = generarPlan(Number(b.dataset.n), S.comida.plan?.preferencias || {});
    if (!plan) return toast('No se pudo generar el plan', 'bad');
    guardarPlan(plan);
    hoja.close();
    pintar();
    toast('Plan creado', 'ok');
  });
}

function cambiarAlimento(comidaId, rol) {
  const plan = S.comida.plan;
  const comida = plan.comidas.find((c) => c.id === comidaId);
  const opciones = alimentos().filter((a) => a.rol === rol);

  const hoja = sheet({
    title: `${comida.nombre}: ${rol === 'proteina' ? 'proteína' : 'carbohidrato'}`,
    body: `
      <p class="muted small">Al cambiarlo recalculo las cantidades para que los macros sigan cuadrando.</p>
      <div class="stack" style="gap:8px;margin-top:12px">
        ${opciones.map((a) => `
          <button class="list-item" data-id="${a.id}" style="${comida.elegidos[rol] === a.id ? 'border-color:var(--accent)' : ''}">
            <div class="body">
              <b>${esc(a.nombre)}</b>
              <small>${a.kcal} kcal · ${num(a.p)} P / ${num(a.c)} C / ${num(a.g)} G por 100 ${a.unidad}</small>
            </div>
          </button>`).join('')}
      </div>`,
  });

  hoja.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const prefs = { ...(plan.preferencias || {}), [`${comidaId}.${rol}`]: b.dataset.id };
    guardarPlan(generarPlan(plan.nComidas, prefs));
    hoja.close();
    pintar();
  });
}

function revisarCalorias() {
  const r = revisarAjuste();
  if (!r) return toast('Aún no hay datos de peso suficientes');
  const puedeAjustar = r.estado === 'subir' || r.estado === 'bajar';

  const hoja = sheet({
    title: 'Revisión de calorías',
    body: `
      <p class="small">${esc(r.texto)}</p>
      ${puedeAjustar ? `
        <button class="btn primary block mt" data-aplicar>Aplicar ${r.delta > 0 ? '+' : ''}${r.delta} kcal</button>` : ''}
      <p class="tiny faint mt">Reviso la tendencia de tu peso, no el número de un día. Por eso hace falta pesarse varias veces por semana.</p>`,
  });
  hoja.el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-aplicar]')) return;
    aplicarAjuste(r.delta, r.texto);
    hoja.close();
    pintar();
    toast('Calorías ajustadas', 'ok');
  });
}

function listaCompra() {
  const plan = S.comida.plan;
  const total = new Map();
  for (const c of plan.comidas) {
    for (const it of c.items) {
      total.set(it.id, (total.get(it.id) || 0) + it.gramos * 7);
    }
  }
  const filas = [...total.entries()]
    .map(([id, g]) => ({ a: alimento(id), g }))
    .filter((x) => x.a)
    .sort((a, b) => a.a.nombre.localeCompare(b.a.nombre));

  sheet({
    title: 'Compra para 7 días',
    body: `
      <p class="muted small">Cantidades del plan multiplicadas por siete. Redondea al alza en la tienda.</p>
      <div class="stack" style="gap:7px;margin-top:12px">
        ${filas.map((f) => `
          <div class="row small" style="justify-content:space-between">
            <span>${esc(f.a.nombre)}</span>
            <span class="mono faint">${f.g >= 1000 ? `${num(f.g / 1000)} kg` : `${Math.round(f.g)} ${f.a.unidad}`}</span>
          </div>`).join('')}
      </div>`,
  });
}

function detalleComida(id) {
  const c = S.comida.plan.comidas.find((x) => x.id === id);
  if (!c) return;
  const m = macrosDe(c.items);
  sheet({
    title: c.nombre,
    body: `
      <div class="stat-grid">
        <div class="stat hi"><b>${Math.round(m.kcal)}</b><span>kcal</span></div>
        <div class="stat"><b>${Math.round(m.p)}</b><span>proteína</span></div>
        <div class="stat"><b>${Math.round(m.c)}</b><span>carbos</span></div>
      </div>`,
  });
}
