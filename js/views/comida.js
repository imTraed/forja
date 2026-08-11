/* Comida: objetivos calculados, plan con cantidades y checklist del día. */
import { S } from '../store.js';
import { acts, esc, toast, sheet, num, hoyISO } from '../lib/ui.js';
import {
  cargarAlimentos, alimento, alimentos, objetivos, generarPlan, guardarPlan,
  marcarComida, comidasHechas, ingeridoHoy, revisarAjuste, aplicarAjuste, macrosDe,
  diarioDe, anotarEnDiario, borrarDelDiario, macrosDelDiario,
  guardarProducto, productoGuardado, misProductos,
  FACTOR_ACTIVIDAD, OBJETIVOS,
} from '../engine/nutrition.js';
import { buscarCodigo, codigoValido, macrosDe as macrosProducto } from '../data/off.js';
import { escanear, contextoSeguro } from '../lib/escaner.js';

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
    ${tarjetaDiario()}

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
    escanear: () => abrirEscaner(),
    despensa: () => abrirDespensa(),
    crearProducto: () => hojaCrearProducto(),
    borrarEntrada: (n) => { borrarDelDiario(n.dataset.id); pintar(); },
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

/* ==========================================================================
   Diario: escanear el código de barras y anotar lo que has comido
   ========================================================================== */

function tarjetaDiario() {
  const entradas = diarioDe();
  const total = macrosDelDiario();

  return `
    <div class="card">
      <div class="card-head">
        <h3>Lo que he comido</h3>
        ${entradas.length ? `<span class="tag accent">${Math.round(total.kcal)} kcal</span>` : ''}
      </div>

      <div class="row" style="gap:8px">
        <button class="btn primary grow" data-act="escanear">
          <svg viewBox="0 0 24 24"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M7 12h10"/></svg>
          Escanear
        </button>
        <button class="btn quiet" data-act="despensa">Mis productos</button>
      </div>

      ${entradas.length ? `
        <div class="stack" style="gap:7px;margin-top:14px">
          ${entradas.map((e) => `
            <div class="row small" style="justify-content:space-between;align-items:center;gap:10px">
              <div style="min-width:0;flex:1">
                <b class="truncate" style="display:block">${esc(e.nombre)}</b>
                <small class="faint">${e.gramos} g${e.marca ? ` · ${esc(e.marca)}` : ''} · ${Math.round(e.macros.kcal)} kcal · ${Math.round(e.macros.p)} g prot.</small>
              </div>
              <button class="icon-btn" data-act="borrarEntrada" data-id="${e.id}" style="flex:none;width:34px;height:34px">×</button>
            </div>`).join('')}
        </div>`
    : `<p class="tiny faint" style="margin:12px 0 0">
         Apunta el código de barras de lo que comas y te saco las calorías solo. Lo que no esté
         en la base lo creas una vez y queda guardado.
       </p>`}
    </div>`;
}

/** Escáner con la cámara, con la opción de teclear el código si no hay forma. */
async function abrirEscaner() {
  if (!contextoSeguro()) {
    return hojaCodigoManual('La cámara solo funciona en una web con HTTPS. Abre la versión publicada desde el móvil, o escribe el código a mano:');
  }

  const hoja = sheet({
    title: 'Escanear código de barras',
    body: `
      <div style="position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:4/3">
        <video id="cam" style="width:100%;height:100%;object-fit:cover" muted playsinline></video>
        <div style="position:absolute;inset:18% 10%;border:2px solid var(--accent);border-radius:10px;
                    box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div>
      </div>
      <p class="tiny faint center" style="margin-top:10px" id="cam-estado">Encuadra el código dentro del recuadro.</p>
      <button class="btn quiet block" data-manual>Escribir el código a mano</button>`,
    onClose: () => sesion?.parar(),
  });

  let sesion = null;
  const estado = hoja.el.querySelector('#cam-estado');

  hoja.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-manual]')) {
      hoja.close();
      hojaCodigoManual('Escribe los números que hay debajo de las barras:');
    }
  });

  try {
    sesion = await escanear(hoja.el.querySelector('#cam'), (codigo) => {
      hoja.close();
      resolverCodigo(codigo);
    });
  } catch (err) {
    estado.textContent = err.message;
    estado.style.color = 'var(--bad)';
  }
}

function hojaCodigoManual(explicacion) {
  const hoja = sheet({
    title: 'Código de barras',
    body: `
      <p class="muted small">${esc(explicacion)}</p>
      <input class="input num" id="cod" type="text" inputmode="numeric" placeholder="8410188012092"
             style="min-height:56px;font-size:1.2rem;text-align:center;letter-spacing:2px">
      <button class="btn primary block mt" id="cod-ok">Buscar</button>
      <button class="btn quiet block mt" id="cod-nuevo">Crear el producto a mano</button>`,
  });
  hoja.el.querySelector('#cod-ok').onclick = () => {
    const v = hoja.el.querySelector('#cod').value.replace(/\D/g, '');
    if (!codigoValido(v)) return toast('Ese código no tiene pinta de EAN o UPC', 'bad');
    hoja.close();
    resolverCodigo(v);
  };
  hoja.el.querySelector('#cod-nuevo').onclick = () => { hoja.close(); hojaCrearProducto(); };
}

/**
 * Del código al producto. Primero mira en los tuyos —instantáneo y sin red— y
 * solo si no lo conoce pregunta a Open Food Facts.
 */
async function resolverCodigo(codigo) {
  const conocido = productoGuardado(codigo);
  if (conocido) return hojaCantidad(conocido);

  const hoja = sheet({
    title: 'Buscando…',
    body: `<p class="muted small center" style="padding:20px 0">Consultando Open Food Facts para el código <b class="mono">${esc(codigo)}</b>.</p>`,
  });

  const { estado, producto } = await buscarCodigo(codigo);
  hoja.close();

  if (estado === 'ok') return hojaCantidad(producto, true);

  const motivo = {
    'no-encontrado': 'Ese producto no está en la base. Es normal con marcas de aquí: créalo una vez y ya se queda guardado para siempre.',
    'sin-datos': 'El producto está en la base pero sin la información nutricional. Métela tú una vez y listo.',
    'sin-red': 'No he podido conectarme. Puedes meter los datos a mano ahora y seguir.',
  }[estado];

  hojaCrearProducto(codigo, motivo);
}

/** Cuánto te has comido. Se guarda el producto y la cantidad va al diario. */
function hojaCantidad(producto, esNuevo = false) {
  const sugerida = producto.racion || 100;
  const hoja = sheet({
    title: producto.nombre,
    body: `
      <div class="row" style="gap:12px;align-items:center">
        ${producto.imagen ? `<img src="${esc(producto.imagen)}" alt="" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:10px;flex:none">` : ''}
        <div style="min-width:0">
          ${producto.marca ? `<div class="tiny faint">${esc(producto.marca)}</div>` : ''}
          <div class="tiny faint">${producto.kcal} kcal · ${num(producto.p)} P / ${num(producto.c)} C / ${num(producto.g)} G por 100 g</div>
        </div>
      </div>

      <div class="field mt">
        <label>¿Cuántos gramos?</label>
        <input class="input num" id="gramos" type="number" inputmode="decimal" value="${sugerida}"
               style="min-height:58px;font-size:1.4rem;text-align:center">
      </div>
      <div class="chips" style="margin-bottom:14px">
        ${[30, 50, 100, 150, 200, producto.racion].filter((v, i, a) => v && a.indexOf(v) === i)
    .map((v) => `<button class="chip" data-g="${v}">${v} g</button>`).join('')}
      </div>

      <div id="previo" class="stat-grid" style="margin-bottom:14px"></div>
      <button class="btn primary block lg" id="anadir">Añadir a lo que he comido</button>
      ${esNuevo ? '<p class="tiny faint center mt">Se guarda en tus productos: el próximo escaneo será instantáneo y sin conexión.</p>' : ''}`,
  });

  const campo = hoja.el.querySelector('#gramos');
  const previo = hoja.el.querySelector('#previo');
  const refrescar = () => {
    const m = macrosProducto(producto, campo.value);
    previo.innerHTML = `
      <div class="stat hi"><b>${Math.round(m.kcal)}</b><span>kcal</span></div>
      <div class="stat"><b>${Math.round(m.p)}</b><span>proteína</span></div>
      <div class="stat"><b>${Math.round(m.c)}</b><span>carbos</span></div>`;
  };

  campo.addEventListener('input', refrescar);
  hoja.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (b) { campo.value = b.dataset.g; refrescar(); }
  });
  hoja.el.querySelector('#anadir').onclick = () => {
    const g = Number(campo.value);
    if (!g || g <= 0) return toast('¿Cuántos gramos?', 'bad');
    guardarProducto(producto);
    anotarEnDiario(producto, g);
    hoja.close();
    pintar();
    toast('Anotado', 'ok');
  };
  refrescar();
}

/** Para lo que Open Food Facts no tiene, que en Ecuador es casi todo lo local. */
function hojaCrearProducto(codigo = null, explicacion = null) {
  const hoja = sheet({
    title: 'Crear producto',
    body: `
      ${explicacion ? `<p class="muted small">${esc(explicacion)}</p>` : ''}
      <p class="tiny faint">Copia los valores del envase, en la columna de <b>por 100 g</b>.</p>
      <div class="field"><label>Nombre</label>
        <input class="input" id="np" placeholder="Atún en lata La Real"></div>
      <div class="row">
        <div class="field grow"><label>Calorías</label>
          <input class="input num" id="nk" type="number" inputmode="decimal" placeholder="120"></div>
        <div class="field grow"><label>Proteína (g)</label>
          <input class="input num" id="npr" type="number" inputmode="decimal" placeholder="24"></div>
      </div>
      <div class="row">
        <div class="field grow"><label>Carbos (g)</label>
          <input class="input num" id="nc" type="number" inputmode="decimal" placeholder="0"></div>
        <div class="field grow"><label>Grasas (g)</label>
          <input class="input num" id="ng" type="number" inputmode="decimal" placeholder="1"></div>
      </div>
      <button class="btn primary block lg" id="ncrear">Guardar producto</button>`,
  });

  hoja.el.querySelector('#ncrear').onclick = () => {
    const val = (id) => Number(hoja.el.querySelector(id).value);
    const nombre = hoja.el.querySelector('#np').value.trim();
    if (!nombre) return toast('Ponle un nombre', 'bad');
    const kcal = val('#nk');
    if (!kcal || kcal < 0) return toast('Faltan las calorías por 100 g', 'bad');

    const producto = {
      codigo,
      nombre,
      marca: '',
      imagen: '',
      kcal,
      p: val('#npr') || 0,
      c: val('#nc') || 0,
      g: val('#ng') || 0,
      racion: null,
      origen: 'propio',
    };
    guardarProducto(producto);
    hoja.close();
    hojaCantidad(producto);
  };
}

/** Tus productos: lo que más repites, arriba. */
function abrirDespensa() {
  const lista = misProductos();
  const hoja = sheet({
    title: 'Mis productos',
    body: `
      ${lista.length ? `
        <input class="input" id="buscar" placeholder="Buscar…" style="margin-bottom:12px">
        <div id="lista-prod" class="stack" style="gap:8px"></div>`
    : '<p class="muted small">Aún no tienes ninguno. Escanea algo y se irá guardando solo.</p>'}
      <button class="btn ghost block mt" id="nuevo">Crear producto a mano</button>`,
  });

  hoja.el.querySelector('#nuevo').onclick = () => { hoja.close(); hojaCrearProducto(); };
  if (!lista.length) return;

  const cont = hoja.el.querySelector('#lista-prod');
  const pintarLista = (q = '') => {
    const filtrada = lista.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()));
    cont.innerHTML = filtrada.length ? filtrada.map((p) => `
      <button class="list-item" data-codigo="${esc(p.codigo || p.nombre)}" style="margin:0">
        <div class="body">
          <b class="truncate" style="display:block">${esc(p.nombre)}</b>
          <small>${p.kcal} kcal · ${num(p.p)} P / ${num(p.c)} C / ${num(p.g)} G por 100 g</small>
        </div>
      </button>`).join('') : '<p class="faint small center">Nada con ese nombre.</p>';
  };

  hoja.el.querySelector('#buscar').addEventListener('input', (e) => pintarLista(e.target.value));
  cont.addEventListener('click', (e) => {
    const b = e.target.closest('[data-codigo]');
    if (!b) return;
    const p = lista.find((x) => (x.codigo || x.nombre) === b.dataset.codigo);
    if (p) { hoja.close(); hojaCantidad(p); }
  });
  pintarLista();
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
